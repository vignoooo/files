---
description: Add a bespoke mini-CMS to a built site, e.g. /add-cms hartford-electrical
---

Add a bespoke content management layer to the site in `sites/$ARGUMENTS/`, so the
business owner can update their own text, photos, and reviews:

1. Refactor the page so all owner-editable content (headline, about text, hours,
   reviews, photo list) loads from a single `content.json` at runtime, with the
   current values as defaults baked into the HTML for no-JS visitors.
2. Create `admin.html` — a self-contained, password-less local editor: it loads
   `content.json`, shows a friendly form (plain language, no jargon), previews
   changes live, and produces a downloadable updated `content.json` with clear
   one-line instructions for replacing the file wherever the site is hosted.
3. Keep everything self-contained (no external libraries, no backend) and match the
   site's existing design language in the admin UI.
4. Re-run `node bin/websmith.js qa <slug>` and confirm it still passes.

This is a selling point in the pitch: mention in the draft that the owner can update
the site themselves.
