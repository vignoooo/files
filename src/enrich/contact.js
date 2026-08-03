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

// Checks the business's website (plus its /contact page) and public Facebook
// page. Returns { email, source } or { email: null }.
export async function discoverContact(lead, socials = {}) {
  const attempts = [];
  if (lead.existingSite?.url) {
    attempts.push({ url: lead.existingSite.url, source: "website" });
    attempts.push({ url: new URL("/contact", lead.existingSite.url).toString(), source: "website" });
  }
  if (socials.facebook) attempts.push({ url: socials.facebook, source: "facebook" });

  for (const { url, source } of attempts) {
    try {
      const emails = extractEmails(await fetchHtml(url));
      if (emails.length) return { email: emails[0], source };
    } catch (err) {
      log(`contact: ${source} check skipped (${err.message})`);
    }
  }
  return { email: null, source: null };
}
