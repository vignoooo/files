---
description: Add local-SEO structure to a built site, e.g. /add-seo driveway-garage
---

Optimise the site in `sites/$ARGUMENTS/` for local search:

1. Add `application/ld+json` LocalBusiness structured data built strictly from
   `brief.json` (name, address, phone, hours, geo if known, aggregateRating only if
   real rating data exists).
2. Tune `<title>` and meta description to the "{service} in {town}" pattern using
   the business's real category and location.
3. Add Open Graph tags (using a real photo from `assets/` if present), a canonical
   URL placeholder, `robots.txt`, and a minimal `sitemap.xml`.
4. Check heading hierarchy (one h1, sensible h2s) and image alt text mention the
   service + town naturally — no keyword stuffing.
5. Re-run `node bin/websmith.js qa <slug>` and confirm it passes.
