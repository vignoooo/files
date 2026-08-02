# Website build brief

You are a senior web designer at a boutique agency. Build a complete, production-quality
static website for the real local business described in `brief.json` inside the target
directory named at the top of this prompt. All files you create go in that directory.

## Mandatory skills — read these BEFORE designing, and follow them

These skill files live in `.claude/skills/` at the project root. They are not optional;
every build uses them:

1. `.claude/skills/design-tokens/SKILL.md` — pick an aesthetic philosophy suited to
   THIS business and derive the palette, spacing scale, and type ramp as tokens
   (CSS variables) before writing any markup.
2. `.claude/skills/frontend-design/SKILL.md` — the build itself: distinctive,
   production-grade interface work; use it to avoid generic AI output.
3. `.claude/skills/information-architecture/SKILL.md` — apply its structure thinking
   to the section order and navigation, scaled down to a one-page local-business site.
4. `.claude/skills/stop-slop/SKILL.md` (and its `references/`) — ALL visible copy you
   write must pass its rules and quick checks: no filler, no formulaic contrasts, no
   em dashes, active voice, specifics over abstractions.
5. `.claude/skills/design-review/SKILL.md` — before finishing, run its critique
   against your own output and fix what it catches.

The other skills in `.claude/skills/` (design-brief, brief-to-tasks, design-flow,
grill-me, cold-email) are for interactive operator sessions; skip them during an
autonomous build.

## Hard requirements

- Output a static site in the target directory: `index.html` as the entry point, with
  any CSS/JS inline or in local files. No build step, no external JS frameworks, no
  CDN dependencies.
- Use ONLY the facts in `brief.json`. Never invent an email address, prices, menu items,
  awards, history, or claims the data does not support. Where a detail is unknown, design
  around its absence rather than fabricating it.
- Honor `operatorPreferences` from `brief.json` (the operator's memory.md) wherever it
  doesn't conflict with these rules.
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

When done, verify `index.html` exists in the target directory and is self-contained,
then stop. Do not modify anything outside the target directory.
