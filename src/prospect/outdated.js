// Checks whether an existing business website is outdated enough to pitch a
// rebuild. Cheap, fetch-based heuristics — no browser needed.
export async function checkWebsite(url) {
  const issues = [];
  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; websmith-check/0.1)" }
    });
    if (!res.ok) issues.push(`site returns HTTP ${res.status}`);
    else html = await res.text();
    if (new URL(res.url).protocol === "http:") issues.push("no HTTPS");
  } catch {
    issues.push("site is unreachable");
  }

  if (html) {
    const head = html.slice(0, 20000);
    if (!/name=["']viewport["']/i.test(head)) issues.push("not mobile-friendly (no viewport meta)");
    if (!/<title>[^<]{2,}/i.test(head)) issues.push("missing page title");
    if (!/name=["']description["']/i.test(head)) issues.push("no meta description (weak SEO)");
    if (/<frameset|<font\b|<marquee/i.test(html)) issues.push("built with obsolete HTML");
    if (/wix\.com\/website-builder|godaddysites\.com|business\.site/i.test(html)) {
      issues.push("free site-builder page, not a real website");
    }
  }

  return { url, issues, outdated: issues.length >= 2 };
}
