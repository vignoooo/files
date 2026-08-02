---
description: Check info@vigno.ca for replies to websmith pitches, classify them, update the CRM, and draft responses
---

Work through the reply inbox for the websmith pipeline. Use the Gmail connector
with the **info@vigno.ca** account (if it isn't connected, stop and tell the
operator to connect it first).

1. Read `data/leads.json` and collect leads with status `pitched` or `later`,
   noting each business name and pitch subject (from `outbox/<slug>.md`).
2. Search the inbox for replies: threads matching each pitched business's name or
   a reply to our subject lines ("un site web pour ...", "a website for ...")
   newer than the lead's last touch.
3. For each reply found, read the full thread and classify:
   - interested / wants a call / wants changes -> `node bin/websmith.js reply <slug> interested`
   - clear no / take it down -> `node bin/websmith.js reply <slug> no`, and if
     they asked for removal, ALSO run `node bin/websmith.js retire <slug>`
     immediately — the take-down promise is honoured same-day.
   - "later / busy / call me next month" -> `node bin/websmith.js reply <slug> later`
4. For every interested reply, draft the response using the cold-email and
   stop-slop skills plus `.agents/product-marketing.md` (the close: live on your
   domain in under 7 days, from $999, 50% upfront, you own everything, hosting
   from $29/mo; offer the 30-minute discovery call, link from app settings).
   Create the draft in the info@vigno.ca mailbox as a Gmail DRAFT in the same
   thread. NEVER send — the operator reviews and sends. Honour the
   reply-within-24h promise by flagging anything older than 20 hours as URGENT.
5. Report: replies found, classification, CRM updates made, drafts created,
   anything urgent.
