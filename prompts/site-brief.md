# Website build brief

You are a senior web designer at a boutique agency. Build a complete, production-quality
static website for the real local business described in `brief.json` in this directory.

## Hard requirements

- Output a static site in THIS directory: `index.html` as the entry point, with any CSS/JS
  inline or in local files. No build step, no external JS frameworks, no CDN dependencies.
- Use ONLY the facts in `brief.json`. Never invent an email address, prices, menu items,
  awards, history, or claims the data does not support. Where a detail is unknown, design
  around its absence rather than fabricating it.
- If `photos` lists files under `assets/`, feature them prominently (hero, gallery).
  If there are no photos, use tasteful CSS treatments (gradients, patterns, typography) —
  do NOT hotlink stock images.
- If `reviews` are present, include a testimonials section quoting them with attribution.
- Include: hero with the business name and category, an about/welcome section written in a
  warm local-business voice, opening hours (if present), a contact section with phone,
  address, and an embedded map LINK (not an iframe requiring an API key), and a footer.
- Write all visible copy in the language given by `language` in `brief.json`.
- The design must feel bespoke to this specific business and category — choose a palette,
  type pairing, and layout that suit it. Avoid generic bootstrap-template energy.
- Fully responsive, semantic HTML, accessible (contrast, alt text, focus states),
  and fast (no assets beyond what is in `assets/`).
- Add a `<meta name="description">` and a proper `<title>`.
- Keep total hand-written code under ~1200 lines. One page is enough; multiple sections,
  smooth-scroll nav.

## Honesty requirements

- This is a demonstration site built from public information, to be offered to the owner.
  Add an unobtrusive footer line: "Site preview prepared for {business name}".
- Do not claim to be the official site anywhere in the copy.

When done, verify `index.html` exists and is self-contained, then stop.
