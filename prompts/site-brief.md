# Website build brief

You are a senior web designer at a boutique agency. Build a complete, production-quality
static website for the real local business described in `brief.json` inside the target
directory named at the top of this prompt. All files you create go in that directory.

## Mandatory process: the full design-flow, run autonomously

Follow the complete `/design-flow` sequence from `.claude/skills/design-flow/SKILL.md`
in order — all seven phases, every build. The flow is interactive by design ("each
phase confirms before advancing"); you are running it headless, so at each
confirmation point you decide and move on, recording the decision instead of asking.
Write each phase's artifact to `_design/` inside the target directory:

1. **Grill me** (`.claude/skills/grill-me/SKILL.md`) — with no designer to grill,
   grill the data: interrogate `brief.json` the way the skill interrogates a person.
   What is this business really selling? Who walks in? What's the one thing the site
   must make a visitor do? Resolve every branch from the data; note open questions
   and the assumption you chose. -> `_design/GRILL.md`
2. **Design brief** (`.claude/skills/design-brief/SKILL.md`) — answer its interview
   questions yourself from GRILL.md + brief.json (skip codebase-exploration steps
   that don't apply to a fresh static site). -> `_design/DESIGN_BRIEF.md`
3. **Information architecture** (`.claude/skills/information-architecture/SKILL.md`)
   — section order, navigation, content hierarchy, scaled to a one-page
   local-business site. -> `_design/INFORMATION_ARCHITECTURE.md`
4. **Design tokens** (`.claude/skills/design-tokens/SKILL.md`) — pick an aesthetic
   philosophy suited to THIS business; derive palette, spacing scale, and type ramp
   as CSS variables before any markup. -> `_design/tokens.css` (then inline into the
   final page to keep it self-contained)
5. **Brief to tasks** (`.claude/skills/brief-to-tasks/SKILL.md`) — break the build
   into ordered vertical slices. -> `_design/TASKS.md`
6. **Frontend design** (`.claude/skills/frontend-design/SKILL.md`) — build the site,
   task by task: distinctive, production-grade work that avoids generic AI output.
7. **Design review** (`.claude/skills/design-review/SKILL.md`) — run its structured
   critique against your own output, fix what it catches, iterate back to phase 6 if
   needed. -> `_design/DESIGN_REVIEW.md`

Throughout every phase: ALL visible copy must pass `.claude/skills/stop-slop/SKILL.md`
and its `references/` quick checks — no filler, no formulaic contrasts, no em dashes,
active voice, specifics over abstractions.

(`cold-email` in `.claude/skills/` is for outreach drafting, not site builds.)

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
