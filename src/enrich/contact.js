import { log } from "../util.js";

// Discovers a business's PUBLISHED email address — the CASL-relevant kind:
// conspicuously posted by the business itself on its own website or public
// Facebook page. Auto-send only ever uses addresses found this way.

const UA = "Mozilla/5.0 (compatible; websmith-enrich/0.1; +https://vigno.ca)";
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JUNK = /\.(png|jpg|jpeg|gif|webp|svg|css|js)$|example\.|sentry|wixpress|godaddy|schema\.org|@(2x|3x)\b/i;

export function extractEmails(html) {
  const found = [];
  for (const m of html.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase().replace(/^\d+/, "");
    if (JUNK.test(email)) continue;
    if (!found.includes(email)) found.push(email);
  }
  // Prefer obvious business inboxes over personal-looking ones.
  return found.sort((a, b) => rank(b) - rank(a));
}

function rank(email) {
  if (/^(info|contact|bonjour|hello|admin|reception)@/.test(email)) return 2;
  if (/@(gmail|hotmail|yahoo|outlook|videotron|bell)\./.test(email)) return 0;
  return 1;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Common contact-page paths on small-business sites (FR + EN).
const CONTACT_PATHS = ["/contact", "/contactez-nous", "/nous-joindre", "/contact-us", "/about", "/a-propos"];

// Checks every public place a business publishes its address: its own site
// (home + contact pages), its public Facebook page, and its Google Business
// profile page. Returns { email, source } or { email: null }.
export async function discoverContact(lead, socials = {}) {
  const attempts = [];
  const site = lead.existingSite?.url || lead.websiteUri;
  if (site) {
    attempts.push({ url: site, source: "website" });
    for (const path of CONTACT_PATHS) {
      try { attempts.push({ url: new URL(path, site).toString(), source: "website" }); } catch { /* bad base */ }
    }
  }
  if (socials.facebook) {
    attempts.push({ url: socials.facebook, source: "facebook" });
    attempts.push({ url: socials.facebook.replace(/\/$/, "") + "/about", source: "facebook" });
  }

  const seen = new Set();
  for (const { url, source } of attempts) {
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const emails = extractEmails(await fetchHtml(url));
      if (emails.length) return { email: emails[0], source };
    } catch { /* try the next candidate quietly */ }
  }
  log(`contact: no published email found for ${lead.name}`);
  return { email: null, source: null };
}
