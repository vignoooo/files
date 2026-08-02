# vigno-app integration files

Code destined for the VIGNO app repo (github.com/vignoooo/vigno), kept here
because this session can't push to that repo. Everything else on the app side —
`websmith_demos`, `websmith_config`, and the `public.websmith_ingest` API
function — is already live in the app's database; only files in this folder
still need to land in the app repo.

## d.$token.$.ts — the demo proxy route (the missing piece)

Serves websmith demos at `https://vigno.ca/d/<token>/` by reverse-proxying the
underlying deploy, exactly like the app's existing client preview-proxy (same
SSRF guard and URL rewriting; no comment-bridge injection). 404s when a demo is
retired.

Install (either way):

- **Git** (in a session that has vignoooo/vigno, or locally):
  `cp integration/vigno-app/d.\$token.\$.ts <vigno-repo>/src/routes/d.\$token.\$.ts`
  then commit and push — Lovable's GitHub sync rebuilds and deploys.
- **Lovable chat**: paste the file with "add this route file as
  src/routes/d.$token.$.ts, change nothing else."

Verify after deploy: register a demo (any pitched lead re-run, or ask the agent
to call the demo action with a test slug), open the returned URL, then
`node bin/websmith.js retire <slug>` and confirm the link 404s.
