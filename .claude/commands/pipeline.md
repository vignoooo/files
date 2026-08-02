---
description: Run the full pipeline for a region (optionally in parallel), e.g. /pipeline Sherbrooke x3
---

Run the website agency pipeline. Arguments: $ARGUMENTS (a region, and optionally
"xN" for parallelism).

1. If a region was given, set it in `websmith.config.json`; if "xN" was given, set
   `parallel` to N.
2. `node bin/websmith.js doctor` — fix anything red before proceeding.
3. Run `node bin/websmith.js run` repeatedly until the current batch of leads
   reaches `pitched` (or fails). Watch the log between cycles.
4. For each site that reaches `built`, launch the qa-reviewer agent on it (it
   applies the design-review and stop-slop skills).
5. For each pitch draft that lands in `outbox/`, launch the outreach-writer agent
   to polish it with the cold-email and stop-slop skills.
6. Finish with `node bin/websmith.js status` and report: each business, its score,
   the live URL, and where its pitch draft is. Remind the operator the drafts in
   `outbox/` are theirs to review and send.
