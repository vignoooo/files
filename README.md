# websmith

**A whole website agency. Fully autonomous.** Websmith runs an autonomous pipeline on
your own machine: it finds local businesses without websites — or with outdated ones —
ranks them by how likely they are to buy, gathers their real photos and data from
public sources, builds each one a designer-quality bespoke site with Claude Code,
QA-reviews it with fresh eyes, deploys it, and drafts the personalised pitch — a
working website with its own link, ready to send to the owner. Then the built-in CRM
runs the five-touch follow-up cadence and sorts the replies.

Inspired by [klaudius.dev](https://klaudius.dev). Zero runtime dependencies — plain
Node.js ≥ 18.17.

## The pipeline

```
prospect ──> enrich ──> build ──> QA ──> deploy ──> pitch ──> CRM
(find +      (photos,   (Claude   (checks (live     (draft in  (5-touch
 rank by      reviews,   Code      + fresh URL)      outbox —   sequence,
 buy-         hours)     builds    screen-           YOU send   replies,
 likelihood)             the site) shots)            it)        lapse)
```

Every lead is tracked in `data/leads.json` and marched through the stages each cycle,
`parallel` leads at a time. Run it once, on a schedule, or as a daemon — it's built
for volume: multiple professional, agency-style websites pitched per day.

## The project is the product

This is also a Claude Code project. Open `claude` in the repo and just talk to it:

- **`/pipeline Sherbrooke x3`** — run the whole pipeline for a region, 3 leads in
  parallel, with agent QA on every build.
- **`/add-cms <slug>`, `/add-bookings <slug>`, `/add-seo <slug>`** — one-command
  add-ons that extend a built site (owner-editable CMS, booking flow, local SEO).
- **Agents** — `qa-reviewer` (fresh-context visual review of the QA screenshots),
  `lead-scout` (deep research on one lead), `outreach-writer` (sharper drafts,
  reply handling).
- **`memory.md`** — preferences you teach the agent (design tweaks, outreach tone,
  regional patterns) persist across runs and are injected into every build brief.
- **Vendored skills** (`.claude/skills/`) — every build runs the full
  [designer-skills](https://github.com/julianoczkowski/designer-skills) `/design-flow`
  (Apache-2.0), all seven phases: grill-me → design-brief → information-architecture
  → design-tokens → brief-to-tasks → frontend-design → design-review, with phase
  artifacts saved to `sites/<slug>/_design/` (kept off the live site at deploy).
  All copy must pass `stop-slop`; all outreach drafting follows `cold-email`. The
  build brief and the agents enforce this — it isn't optional.
- Anything else — config, prompts, templates and source are all editable; ask the
  agent to change whatever you want. `CLAUDE.md` carries its operating rules.

## Quick start

```bash
node bin/websmith.js init      # creates websmith.config.json
# edit websmith.config.json: set region, categories, operator name/email
node bin/websmith.js doctor    # verify the machine is ready
node bin/websmith.js run       # one full cycle
node bin/websmith.js status    # the funnel, with lead scores
node bin/websmith.js preview <slug>   # view a built site locally
node bin/websmith.js daemon    # run continuously
```

When a pitch goes out or a business answers:

```bash
node bin/websmith.js crm                      # due follow-ups, warm/won/lapsed
node bin/websmith.js touch <slug>             # record a sent touch (5 max: day 0/3/7/14/30)
node bin/websmith.js reply <slug> interested  # or: no | later
node bin/websmith.js won <slug>               # closed the deal
```

Follow-up nudge drafts appear in `outbox/` automatically when a touch comes due.

## Configuration (`websmith.config.json`)

| Key | Values | Notes |
|---|---|---|
| `region` | `"Sherbrooke, QC"` | Where to hunt. Required. |
| `categories` | `["restaurant", ...]` | Priority order. |
| `prospector` | `overpass` \| `google` | `overpass` (OpenStreetMap) is free, no key. `google` finds richer leads (photos, reviews) and needs `GOOGLE_MAPS_API_KEY` (Places API (New)). |
| `includeOutdated` | bool | Google prospector also targets businesses whose existing site fails heuristics (unreachable, no HTTPS, not mobile-friendly, obsolete HTML...). |
| `builder` | `claude` \| `codex` \| `template` | `claude` drives headless Claude Code with `prompts/site-brief.md` — needs the CLI and a subscription (Max recommended for throughput). `template` is a no-AI fallback. |
| `deployer` | `none` \| `vercel` \| `netlify` | `none` keeps sites local. Vercel/Netlify shell out to their CLIs. |
| `parallel` | number | Leads processed concurrently per stage ("run pipeline x3" → 3). |
| `chromePath` | path | Chromium for QA screenshots (auto-detected if empty; QA static checks run regardless). |
| `language` | `en` \| `fr` \| ... | Site copy + pitch language. |
| `operator` | `{ name, email }` | Signs the pitch drafts. |
| `designNotes` | free text | Extra art direction for the builder. |

## QA: it checks its own work

After every build, `src/qa.js` runs static checks (self-containment, broken local
references, viewport/title/description, business name present, alt text) and captures
desktop + mobile screenshots into `sites/<slug>/qa/`. A failing site gets one
automatic agent fix pass, then must pass or it's marked failed. The `qa-reviewer`
agent inspects the screenshots with fresh eyes — deliberately a separate context from
the builder, which has tunnel vision after a long build.

## What lands where

- `sites/<slug>/` — `brief.json` (all gathered facts + your `memory.md` preferences),
  `assets/` (downloaded photos), the generated site, `qa/` screenshots, `qa-report.json`.
- `outbox/<slug>.md`, `outbox/<slug>-touch-N.md` — pitch + follow-up drafts.
- `data/leads.json` — the funnel/CRM: stage, score, touches, replies, history.

## Honesty and outreach — read this

Websmith **never contacts a business on its own**. Pitches and follow-ups are drafts
in your outbox; you review and send them yourself. Unsolicited commercial email is
regulated — **CASL** in Canada, **CAN-SPAM** in the US, **GDPR/ePrivacy** in the EU —
and complying is your responsibility. Practical guidance:

- Prefer phone, walking in, or a contact form over cold email where the law is strict
  (CASL especially).
- The generated sites say "Site preview prepared for {business}" and never claim to
  be official. Keep it that way.
- Take a preview site down immediately if the owner asks.
- Sites are built only from public information, and the builder brief forbids
  fabricating claims, prices, or history.

## Development

```bash
node --test   # scoring, CRM sequence/replies/lapse, QA checks, builder, pitch, store
```

Key modules: `src/pipeline.js` (orchestrator), `src/score.js` (lead ranking),
`src/crm.js` (five-touch sequence, reply sorting, lapse detection), `src/qa.js`
(static checks + screenshots), `src/prospect/` (Google Places / OSM Overpass /
outdated-site heuristics), `src/build/` (headless Claude Code + fix pass / template
fallback), `src/deploy/` (Vercel/Netlify), `src/pitch.js` (outbox drafts),
`src/store.js` (JSON funnel).
