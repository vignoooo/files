---
description: Verify info@vigno.ca outreach deliverability (SPF/DKIM/DMARC) with a real round-trip test
---

Check whether outreach from **info@vigno.ca** lands cleanly. Two steps, like
Klaudius's /deliverability: a real round-trip first (authoritative), then DNS.

1. Round-trip: using the Gmail connector (info@vigno.ca account), create a draft
   to info@vigno.ca itself with subject "websmith deliverability test <today's
   date>", ask the operator to confirm sending it, send, wait for it to arrive,
   then read the received message's headers. Report the Authentication-Results
   verdicts stamped on it: SPF pass/fail, DKIM pass/fail (and the signing
   domain), DMARC pass/fail.
2. DNS: look up vigno.ca's TXT records (`dig txt vigno.ca`, `dig txt
   _dmarc.vigno.ca`, and the DKIM selector from step 1's signature, e.g.
   `dig txt <selector>._domainkey.vigno.ca`). For anything missing or failing,
   give the exact record to paste at the registrar:
   - SPF: a single "v=spf1 include:_spf.google.com ~all" TXT on vigno.ca
   - DKIM: enable in Google Workspace Admin and publish the selector record
   - DMARC: "v=DMARC1; p=quarantine; rua=mailto:info@vigno.ca" on _dmarc
3. Verdict: green (all pass), yellow (delivers but weakened), red (likely spam),
   with the one highest-impact fix first. Recommend re-running after DNS changes
   and any time replies dry up.
