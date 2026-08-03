import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { downloadGooglePhoto, lookupPlace } from "./prospect/google.js";
import { gatherWebPhotoUrls, downloadPhotos } from "./enrich/photos.js";
import { discoverContact } from "./enrich/contact.js";
import { writeJson, log } from "./util.js";

// Prepares the per-lead workspace: sites/<slug>/ with brief.json and assets/.
// Downloads real photos when the source provides them (Google Places).
export async function enrich(cfg, lead) {
  const siteDir = join(cfg.sitesDir, lead.slug);
  const assetsDir = join(siteDir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  // Leads found by other prospectors get upgraded with Google's data when a
  // key is available: photos, reviews, rating, phone, and a real maps link.
  if (lead.source !== "google" && cfg.googleApiKey && !lead.photoRefs?.length) {
    try {
      const match = await lookupPlace(cfg, `${lead.name} ${lead.address || cfg.region}`);
      // Sanity check: only merge when it's plausibly the same business.
      if (match && match.slug.split("-")[0] === lead.slug.split("-")[0]) {
        lead.photoRefs = match.photoRefs;
        lead.reviews = lead.reviews?.length ? lead.reviews : match.reviews;
        lead.rating = lead.rating ?? match.rating;
        lead.ratingCount = lead.ratingCount || match.ratingCount;
        lead.phone = lead.phone || match.phone;
        lead.hours = lead.hours?.length ? lead.hours : match.hours;
        lead.mapsUrl = match.mapsUrl || lead.mapsUrl;
        log(`enrich: ${lead.name} — upgraded with Google data (${match.photoRefs.length} photos, ${match.ratingCount} ratings)`);
      }
    } catch (err) {
      log(`enrich: google upgrade skipped — ${err.message}`);
    }
  }

  // Photo sources, in order of quality: Google Places, then the business's
  // existing website, then the public og:image of linked Instagram/Facebook.
  const photos = [];
  if (lead.photoRefs?.length && cfg.googleApiKey) {
    for (const ref of lead.photoRefs.slice(0, cfg.maxPhotos)) {
      try {
        const buf = await downloadGooglePhoto(cfg, ref);
        const file = `photo-${photos.length + 1}.jpg`;
        writeFileSync(join(assetsDir, file), buf);
        photos.push(`assets/${file}`);
      } catch (err) {
        log(`enrich: photo skipped for ${lead.name}: ${err.message}`);
      }
    }
  }

  let socials = { instagram: null, facebook: null };
  if (photos.length < cfg.maxPhotos) {
    const gathered = await gatherWebPhotoUrls(lead, cfg.maxPhotos - photos.length);
    socials = gathered.socials;
    if (gathered.urls.length) {
      const extra = await downloadPhotos(gathered.urls, assetsDir, {
        startIndex: photos.length,
        max: cfg.maxPhotos - photos.length
      });
      photos.push(...extra);
      if (extra.length) log(`enrich: ${extra.length} photo(s) from website/socials for ${lead.name}`);
    }
  }

  const brief = {
    business: {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      hours: lead.hours,
      rating: lead.rating,
      ratingCount: lead.ratingCount,
      reviews: lead.reviews,
      mapsUrl: lead.mapsUrl,
      existingSite: lead.existingSite || null,
      socials
    },
    photos,
    language: cfg.language,
    designNotes: cfg.designNotes,
    // Cross-run preferences the operator has taught the agent (memory.md).
    operatorPreferences: readMemory(cfg)
  };
  writeJson(join(siteDir, "brief.json"), brief);

  // Published email discovery (website + public Facebook page) — the only
  // kind of address auto-outreach is ever allowed to use.
  const contact = await discoverContact(lead, socials);
  return { siteDir, photos: photos.length, contact };
}

function readMemory(cfg) {
  const path = join(cfg.root || process.cwd(), "memory.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
