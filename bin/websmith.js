#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig, DEFAULTS } from "../src/config.js";
import { runCycle, runDaemon, statusReport, Store } from "../src/pipeline.js";
import { runQa } from "../src/qa.js";
import { recordTouch, recordReply, markWon, crmReport, nextTouchDue, TOUCH_OFFSETS_DAYS } from "../src/crm.js";
import { vignoEnabled, pushStage, retireDemo } from "../src/sync/vigno.js";
import { writeJson, log } from "../src/util.js";

const execFileP = promisify(execFile);
const [, , command, ...rest] = process.argv;

const HELP = `websmith — an autonomous website agency pipeline

Pipeline:
  websmith init                 Create websmith.config.json here
  websmith run                  One full cycle (prospect -> enrich -> build -> QA -> deploy -> pitch)
  websmith daemon               Run cycles continuously
  websmith status               Every lead, its stage and score
  websmith qa <slug>            Re-run QA checks + screenshots on a built site
  websmith preview <slug>       Serve a built site on http://localhost:8787
  websmith retry <slug>         Reset a failed lead to its last good stage
  websmith retire <slug>        Take a demo offline (owner asked, or cleanup)
  websmith outreach             Send due auto-outreach now (respects gates/caps)
  websmith install-autostart    Run the daemon 24/7 via macOS launchd
  websmith doctor               Check the machine: node, chromium, builder CLI, config, keys

CRM (after a pitch is drafted):
  websmith crm                  Funnel overview: due follow-ups, warm, won, lapsed
  websmith touch <slug>         Record that you sent the current touch (max ${TOUCH_OFFSETS_DAYS.length})
  websmith reply <slug> <interested|no|later>   Record the business's reply
  websmith won <slug>           Mark the deal closed
`;

async function main() {
  const cfg = loadConfig();
  const store = () => new Store(cfg.dataDir);
  const need = (s) => {
    const lead = new Store(cfg.dataDir).get(s || "");
    if (!lead) throw new Error(`No lead "${s || ""}". Try: websmith status`);
    return lead;
  };

  switch (command) {
    case "init": {
      const path = resolve(process.cwd(), "websmith.config.json");
      if (existsSync(path)) throw new Error("websmith.config.json already exists.");
      const { dataDir, sitesDir, outboxDir, ...template } = DEFAULTS;
      writeJson(path, template);
      log(`created ${path} — set "region" and "operator", then run: websmith run`);
      break;
    }
    case "run": {
      requireRegion(cfg);
      const summary = await runCycle(cfg);
      log(`cycle complete — ${JSON.stringify(summary.counts)}`);
      break;
    }
    case "daemon":
      requireRegion(cfg);
      await runDaemon(cfg);
      break;
    case "status":
      console.log(statusReport(cfg));
      break;
    case "qa": {
      const lead = need(rest[0]);
      const dir = lead.siteDir || join(cfg.sitesDir, lead.slug);
      const report = await runQa(cfg, lead, dir);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.passed ? 0 : 1;
      break;
    }
    case "crm": {
      const s = store();
      const r = crmReport(s);
      s.save();
      console.log(`due follow-ups: ${r.due.length}`);
      for (const { lead, touchN } of r.due) console.log(`  -> ${lead.name} (${lead.slug}) — touch ${touchN}/${TOUCH_OFFSETS_DAYS.length}`);
      for (const [label, list] of [["warm", r.warm], ["active", r.active], ["won", r.won], ["later+lost+lapsed", [...r.lost, ...r.lapsed]]]) {
        if (list.length) console.log(`${label}: ${list.map((l) => l.slug).join(", ")}`);
      }
      break;
    }
    case "touch": {
      const s = store();
      const lead = s.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}".`);
      const n = recordTouch(s, lead, rest[1] || "email");
      const next = nextTouchDue(lead);
      log(`${lead.name}: touch ${n}/${TOUCH_OFFSETS_DAYS.length} recorded${next ? `, next due ${next.toISOString().slice(0, 10)}` : " — sequence complete"}`);
      await syncStage(lead);
      break;
    }
    case "reply": {
      const s = store();
      const lead = s.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}".`);
      const status = recordReply(s, lead, rest[1]);
      log(`${lead.name}: reply recorded -> ${status}`);
      await syncStage(lead);
      break;
    }
    case "won": {
      const s = store();
      const lead = s.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}".`);
      markWon(s, lead);
      log(`${lead.name}: WON. Nice.`);
      await syncStage(lead);
      break;
    }
    case "retire": {
      const s = store();
      const lead = s.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}".`);
      if (vignoEnabled() && lead.demoToken) {
        await retireDemo(lead.slug);
        log(`${lead.name}: demo taken offline (vigno.ca/d/... now 404s)`);
      } else {
        log(`${lead.name}: no published demo to retire — marking lead closed locally`);
      }
      s.advance(lead, "skipped", { retiredAt: new Date().toISOString() });
      break;
    }
    case "preview": {
      const lead = need(rest[0]);
      const dir = lead.siteDir || join(cfg.sitesDir, lead.slug);
      if (!existsSync(join(dir, "index.html"))) throw new Error(`No built site at ${dir}`);
      await serve(dir);
      break;
    }
    case "retry": {
      const s = store();
      const lead = s.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}".`);
      const dir = lead.siteDir || join(cfg.sitesDir, lead.slug);
      const back = lead.liveUrl ? "deployed"
        : existsSync(join(dir, "index.html")) ? "built"
        : lead.siteDir ? "enriched" : "new";
      s.advance(lead, back, { error: undefined });
      log(`${lead.name} reset to "${back}" — run: websmith run`);
      break;
    }
    case "outreach": {
      const { runOutreach, autoSendReady } = await import("../src/outreach/send.js");
      const readiness = autoSendReady(cfg);
      if (!readiness.ready) throw new Error(`auto-send not configured — missing: ${readiness.missing.join(", ")}`);
      const sent = await runOutreach(cfg, store());
      log(`outreach: ${sent} email(s) sent`);
      break;
    }
    case "install-autostart": {
      if (process.platform !== "darwin") throw new Error("install-autostart currently supports macOS (launchd) only.");
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { homedir } = await import("node:os");
      const label = "ca.vigno.websmith";
      const plistPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
      const logDir = join(cfg.root, "logs");
      mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
      mkdirSync(logDir, { recursive: true });
      writeFileSync(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>${process.execPath}</string>
    <string>${join(cfg.root, "bin", "websmith.js")}</string>
    <string>daemon</string>
  </array>
  <key>WorkingDirectory</key><string>${cfg.root}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${join(logDir, "daemon.log")}</string>
  <key>StandardErrorPath</key><string>${join(logDir, "daemon.log")}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${process.env.PATH || "/usr/local/bin:/usr/bin:/bin"}</string>
  </dict>
</dict></plist>
`);
      const { execFile: ef } = await import("node:child_process");
      const { promisify: pr } = await import("node:util");
      await pr(ef)("launchctl", ["unload", plistPath]).catch(() => {});
      await pr(ef)("launchctl", ["load", plistPath]);
      log(`installed: websmith daemon now runs 24/7 (starts at login, restarts if it dies)`);
      log(`log file:  ${join(logDir, "daemon.log")}  — watch with: tail -f logs/daemon.log`);
      log(`stop with: launchctl unload ${plistPath}`);
      log(`NOTE: your Mac must be awake. System Settings -> Displays -> Advanced ->`);
      log(`"Prevent automatic sleeping on power adapter when the display is off" (plugged in).`);
      break;
    }
    case "doctor":
      await doctor(cfg);
      break;
    default:
      console.log(HELP);
      process.exitCode = command && command !== "help" ? 1 : 0;
  }
}

function requireRegion(cfg) {
  const hasRotation = Array.isArray(cfg.regions) && cfg.regions.length;
  if (!cfg.region && !hasRotation) throw new Error('No region configured. Run "websmith init" and set "region" (or "regions").');
}

// Mirror a CRM stage change to the vigno.ca dashboard, best-effort.
async function syncStage(lead) {
  if (!vignoEnabled() || !lead.vignoLeadId) return;
  try {
    const stage = await pushStage(lead);
    if (stage) log(`crm: vigno.ca stage -> ${stage}`);
  } catch (err) {
    log(`crm: vigno stage sync failed — ${err.message}`);
  }
}

async function doctor(cfg) {
  const checks = [];
  const ok = (name, pass, note = "") => checks.push({ name, pass, note });

  const [maj, min] = process.versions.node.split(".").map(Number);
  ok(`node ${process.versions.node}`, maj > 18 || (maj === 18 && min >= 17), "need >= 18.17");
  ok("websmith.config.json", existsSync(resolve(cfg.root, "websmith.config.json")), 'run "websmith init"');
  const hasRotation = Array.isArray(cfg.regions) && cfg.regions.length;
  ok(hasRotation ? `region rotation: ${cfg.regions.length} regions` : `region: ${cfg.region || "(unset)"}`, !!cfg.region || hasRotation, "required");
  ok(`operator: ${cfg.operator.name || "(unset)"}`, !!cfg.operator.name, "signs your pitches");

  if (cfg.prospector === "google") ok("GOOGLE_MAPS_API_KEY", !!cfg.googleApiKey, "required for google prospector");
  else ok("prospector: overpass (free)", true);

  if (cfg.builder !== "template") {
    const cli = cfg.builder === "codex" ? "codex" : "claude";
    ok(`${cli} CLI on PATH`, await onPath(cli), `install ${cli} or set builder: "template"`);
  } else ok("builder: template (no AI)", true);

  if (cfg.deployer !== "none") ok(`${cfg.deployer} CLI on PATH`, await onPath(cfg.deployer), "install + log in");
  else ok("deployer: none (local preview)", true);

  ok(vignoEnabled() ? "vigno.ca sync: ON (leads + demos publish to your CRM/domain)" : "vigno.ca sync: off (set VIGNO_WEBSMITH_KEY in .env to enable)", true);

  if (cfg.outreach?.autoSend) {
    const { autoSendReady } = await import("../src/outreach/send.js");
    const r = autoSendReady(cfg);
    ok(r.ready ? `auto-send: ON (cap ${cfg.outreach.dailyCap}/day, Mon-Fri ${cfg.outreach.windowHours.join("-")}h)` : `auto-send: ON but missing ${r.missing.join(", ")}`, r.ready);
  } else ok("auto-send: off (drafts only — you send manually)", true);
  if (Array.isArray(cfg.regions) && cfg.regions.length) ok(`region rotation: ${cfg.regions.length} regions`, true);

  const chromes = [cfg.chromePath, process.env.CHROME_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  ok("chromium for QA screenshots", chromes.some((p) => existsSync(p)) || await onPath("chromium") || await onPath("google-chrome"), "optional — static QA still runs");

  let failures = 0;
  for (const c of checks) {
    if (!c.pass) failures++;
    console.log(` ${c.pass ? "✓" : "✗"} ${c.name}${c.pass || !c.note ? "" : ` — ${c.note}`}`);
  }
  console.log(failures ? `\n${failures} problem(s) to fix.` : "\nAll green. Run: websmith run");
  process.exitCode = failures ? 1 : 0;
}

async function onPath(cmd) {
  try { await execFileP("which", [cmd]); return true; } catch { return false; }
}

function serve(dir) {
  const types = { html: "text/html", css: "text/css", js: "text/javascript", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml", json: "application/json", webp: "image/webp" };
  return new Promise(() => {
    createServer(async (req, res) => {
      try {
        const clean = decodeURIComponent(new URL(req.url, "http://x").pathname).replaceAll("..", "");
        const file = join(dir, clean === "/" ? "index.html" : clean);
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": types[file.split(".").pop()] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    }).listen(8787, () => log(`preview: http://localhost:8787 (Ctrl-C to stop)`));
  });
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
