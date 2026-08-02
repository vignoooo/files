import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../util.js";

// Best-effort photo gathering beyond Google Places: the business's existing
// website and the public og:image of Instagram/Facebook pages linked from it.
// Public pages only, one polite fetch per URL, hard timeouts. Social platforms
// often wall content behind login — whatever isn't public is simply skipped.

const UA = "Mozilla/5.0 (compatible; websmith-enrich/0.1; +https://vigno.ca)";
const MIN_BYTES = 8 * 1024;
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

// og:image / twitter:image plus large-looking <img> sources, absolutized.
export function extractImageUrls(html, baseUrl) {
  const urls = [];
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) {
    urls.push(m[1]);
  }
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["']/gi)) {
    urls.push(m[1]);
  }
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const tag = m[0];
    const src = m[1];
    if (/logo|icon|sprite|pixel|tracking|\.svg|\.gif/i.test(src)) continue;
    const w = tag.match(/\bwidth=["']?(\d+)/i)?.[1];
    if (w && Number(w) < 300) continue;
    urls.push(src);
  }
  const absolute = [];
  for (const u of urls) {
    try {
      const abs = new URL(u, baseUrl).toString();
      if (abs.startsWith("http") && !absolute.includes(abs)) absolute.push(abs);
    } catch { /* skip malformed */ }
  }
  return absolute;
}

export function extractSocialLinks(html) {
  const ig = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+/i)?.[0] || null;
  const fb = html.match(/https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|plugins)[A-Za-z0-9.]+/i)?.[0] || null;
  return { instagram: ig, facebook: fb };
}

// Collects candidate photo URLs for a lead from its website and linked socials.
export async function gatherWebPhotoUrls(lead, max) {
  const urls = [];
  const socials = { instagram: lead.instagram || null, facebook: lead.facebook || null };

  if (lead.existingSite?.url) {
    try {
      const { html, finalUrl } = await fetchText(lead.existingSite.url);
      urls.push(...extractImageUrls(html, finalUrl));
      const found = extractSocialLinks(html);
      socials.instagram = socials.instagram || found.instagram;
      socials.facebook = socials.facebook || found.facebook;
    } catch (err) {
      log(`photos: website scrape skipped (${err.message})`);
    }
  }

  for (const social of [socials.instagram, socials.facebook].filter(Boolean)) {
    if (urls.length >= max) break;
    try {
      const { html, finalUrl } = await fetchText(social);
      // Social pages: only the og:image is reliably public.
      const og = extractImageUrls(html, finalUrl).slice(0, 2);
      urls.push(...og.filter((u) => !urls.includes(u)));
    } catch (err) {
      log(`photos: ${new URL(social).hostname} skipped (${err.message})`);
    }
  }

  return { urls: urls.slice(0, max * 2), socials };
}

// Downloads candidates until `max` real images are saved. Returns relative paths.
export async function downloadPhotos(urls, assetsDir, { startIndex = 0, max = 6 } = {}) {
  const saved = [];
  for (const url of urls) {
    if (saved.length >= max) break;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const ext = IMAGE_TYPES[(res.headers.get("content-type") || "").split(";")[0]];
      if (!ext) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) continue;
      const file = `photo-${startIndex + saved.length + 1}.${ext}`;
      writeFileSync(join(assetsDir, file), buf);
      saved.push(`assets/${file}`);
    } catch { /* next candidate */ }
  }
  return saved;
}
