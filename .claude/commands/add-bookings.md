---
description: Add a booking/enquiry system to a built site, e.g. /add-bookings coastal-forge
---

Add a booking flow to the site in `sites/$ARGUMENTS/`:

1. Add a booking section: service picker (from the business's real services in
   `brief.json` — do not invent services), preferred date/time, name, phone,
   message.
2. With no backend available, submit via a `mailto:` link that composes a tidy
   booking-request email to the business (only if a real email exists in
   brief.json) — otherwise generate a "call to book" flow around their real phone
   number with a tap-to-call button and an add-to-calendar (.ics) download for the
   chosen slot.
3. Validate inputs client-side, keep it self-contained, match the site's design.
4. Re-run `node bin/websmith.js qa <slug>` and confirm it passes.
