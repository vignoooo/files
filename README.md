# websmith

**A whole website agency. Fully autonomous.** Websmith runs an autonomous pipeline on
your own machine: it finds local businesses without websites, gathers their real photos
and data from public sources, builds each one a designer-quality bespoke site with
Claude Code, deploys it, and drafts the personalised pitch — a working website with its
own link, ready to send to the owner.

Inspired by [klaudius.dev](https://klaudius.dev). Zero runtime dependencies — plain
Node.js ≥ 18.17.

## The pipeline

```
prospect ──> enrich ──> build ──> deploy ──> pitch
(find a      (photos,   (Claude   (live      (personalised
 business     reviews,   Code      URL via    email draft in
 with no      hours)     builds    Vercel/    your outbox —
 website)                the site) Netlify)   YOU send it)
```

Every lead is tracked in `data/leads.json` and marched through the stages one cycle at
a time. Run it once, on a schedule, or as a daemon — it's built for volume: multiple
professional, agency-style websites pitched per day.

## Quick start

```bash
node bin/websmith.js init      # creates websmith.config.json
# edit websmith.config.json: set region, categories, operator name/email
node bin/websmith.js run       # one full cycle
node bin/websmith.js status    # see the funnel
node bin/websmith.js preview <slug>   # view a built site locally
node bin/websmith.js daemon    # run continuously
```

## Configuration (`websmith.config.json`)

| Key | Values | Notes |
|---|---|---|
| `region` | `"Sherbrooke, QC"` | Where to hunt. Required. |
| `categories` | `["restaurant", ...]` | Priority order. |
| `prospector` | `overpass` \| `google` | `overpass` (OpenStreetMap) is free, no key. `google` finds richer leads (photos, reviews) and needs `GOOGLE_MAPS_API_KEY` in the environment (Places API (New) enabled). |
| `builder` | `claude` \| `codex` \| `template` | `claude` drives headless Claude Code (`claude -p`) with a designer brief (`prompts/site-brief.md`) — needs the Claude Code CLI and an active subscription (Max recommended for throughput). `codex` uses `codex exec`. `template` is a built-in no-AI fallback. |
| `deployer` | `none` \| `vercel` \| `netlify` | `none` keeps sites local for preview. Vercel/Netlify shells out to their CLIs (must be installed and logged in). |
| `language` | `en` \| `fr` \| ... | Site copy + pitch language. |
| `operator` | `{ name, email }` | Signs the pitch drafts. |
| `designNotes` | free text | Extra art direction passed to the builder. |
| `daemonIntervalSeconds` | number | Cycle cadence in daemon mode. |

## What lands where

- `sites/<slug>/` — the lead's workspace: `brief.json` (all gathered facts), `assets/`
  (downloaded photos), and the generated site (`index.html`, self-contained).
- `outbox/<slug>.md` — the pitch draft: subject + body + the live URL, with the
  business's phone and maps link in the front matter.
- `data/leads.json` — the funnel: every lead, its stage, and its history.

## Honesty and outreach — read this

Websmith **never contacts a business on its own**. Pitches are drafts in your outbox;
you review and send them yourself, one at a time. Unsolicited commercial email is
regulated — **CASL** in Canada, **CAN-SPAM** in the US, **GDPR/ePrivacy** in the EU —
and complying is your responsibility. Practical guidance:

- Prefer phone, walking in, or a contact form over cold email where the law is strict
  (CASL especially).
- The generated sites say "Site preview prepared for {business}" and never claim to be
  official. Keep it that way.
- Take a preview site down immediately if the owner asks.
- Sites are built only from public information, and the builder brief forbids
  fabricating claims, prices, or history.

## Development

```bash
npm test   # node --test — store, builder, pitch, slug tests
```

Key modules: `src/pipeline.js` (orchestrator), `src/prospect/` (Google Places / OSM
Overpass), `src/enrich.js` (workspace + photos), `src/build/` (Claude Code headless /
template fallback), `src/deploy/` (Vercel/Netlify adapters), `src/pitch.js` (outbox
drafts), `src/store.js` (JSON lead funnel).
