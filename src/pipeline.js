import { join } from "node:path";
import { Store } from "./store.js";
import { prospectGoogle } from "./prospect/google.js";
import { prospectOverpass, ALL_CATEGORIES } from "./prospect/overpass.js";
import { runOutreach, autoSendReady } from "./outreach/send.js";
import { readJson, writeJson } from "./util.js";
import { enrich } from "./enrich.js";
import { buildWithAgent, fixWithAgent } from "./build/claude.js";
import { buildWithTemplate } from "./build/template.js";
import { runQa } from "./qa.js";
import { deploySite } from "./deploy/index.js";
import { draftPitch } from "./pitch.js";
import { crmReport, draftFollowup } from "./crm.js";
import { vignoEnabled, registerDemo, pushLead } from "./sync/vigno.js";
import { log, sleep } from "./util.js";

// One full cycle: top up leads, then march every stage forward.
// cfg.parallel controls how many leads move through each stage concurrently.
// Round-robin across cfg.regions (or stick to cfg.region when unset), and
// expand categories: "all" when the operator hunts every known type.
function cycleConfig(cfg) {
  const out = { ...cfg };
  if (out.categories === "all") out.categories = shuffle(ALL_CATEGORIES);
  if (Array.isArray(cfg.regions) && cfg.regions.length) {
    const path = join(cfg.dataDir, "rotation.json");
    const state = readJson(path, { i: 0 });
    out.region = cfg.regions[state.i % cfg.regions.length];
    writeJson(path, { i: (state.i + 1) % cfg.regions.length });
  }
  return out;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function runCycle(baseCfg, { prospectLimit = 3 } = {}) {
  const cfg = cycleConfig(baseCfg);
  const store = new Store(cfg.dataDir);
  const n = Math.max(1, cfg.parallel | 0);

  // 1. Prospect — only when the funnel has nothing waiting. With the email
  // gate on, cast a wider net: many candidates won't have a published address.
  if (!store.nextWithStatus("new")) {
    const limit = Math.max(prospectLimit, n) * (cfg.requireEmail ? 5 : 1);
    log(`prospect: hunting in "${cfg.region}"...`);
    try {
      const found = cfg.prospector === "google"
        ? await prospectGoogle(cfg, { limit })
        : await prospectOverpass(cfg, { limit });
      let added = 0;
      for (const lead of found) if (store.add(lead)) added++;
      log(`prospect: ${found.length} candidates (ranked), ${added} new leads added`);
    } catch (err) {
      log(`prospect: failed — ${err.message}`);
    }
  }

  // 2a. Enrich — sequential, and with the email gate on it keeps working
  // through candidates until `n` of them clear the gate. Cheap either way:
  // rejected leads bail before any photo download.
  let enriched = 0;
  let rejected = 0;
  for (const lead of store.leads.filter((l) => l.status === "new")) {
    if (enriched >= n) break;
    try {
      const { siteDir, photos, contact, skipped } = await enrich(cfg, lead);
      if (skipped) {
        store.advance(lead, "skipped", { skipReason: skipped });
        rejected++;
        continue;
      }
      log(`enrich: ${lead.name} — workspace ready, ${photos} photo(s)${contact.email ? `, email: ${contact.email} (${contact.source})` : ""}`);
      store.advance(lead, "enriched", { siteDir, email: contact.email, emailSource: contact.source });
      enriched++;
    } catch (err) {
      log(`enrich: ${lead.name} failed — ${err.message}`);
      store.advance(lead, "failed", { error: err.message });
    }
  }
  if (rejected) log(`enrich: ${rejected} lead(s) skipped for having no published email address`);

  await stage(store, "enriched", n, async (lead) => {
    if (cfg.builder === "template") buildWithTemplate(cfg, lead, lead.siteDir);
    else await buildWithAgent(cfg, lead, lead.siteDir, cfg.builder);
    log(`build: ${lead.name} — site generated (${cfg.builder})`);
    store.advance(lead, "built");
  });

  // QA: fresh checks on every build; one agent fix pass if something's off.
  await stage(store, "built", n, async (lead) => {
    let report = await runQa(cfg, lead, lead.siteDir);
    if (!report.passed && cfg.builder !== "template") {
      log(`qa: ${lead.name} — ${report.issues.length} issue(s), running fix pass`);
      await fixWithAgent(cfg, lead, lead.siteDir, report, cfg.builder);
      report = await runQa(cfg, lead, lead.siteDir);
    }
    if (!report.passed) throw new Error(`QA failed: ${report.issues.join("; ")}`);
    if (report.warnings.length) log(`qa: ${lead.name} — passed with warnings: ${report.warnings.join("; ")}`);
    else log(`qa: ${lead.name} — passed clean`);
    store.advance(lead, "qa", { qa: { issues: report.issues, warnings: report.warnings } });
  });

  await stage(store, "qa", n, async (lead) => {
    let url = await deploySite(cfg, lead, lead.siteDir);
    const patch = { liveUrl: url };
    // With vigno sync on, the public link becomes vigno.ca/d/<token> and the
    // underlying deploy URL stays hidden behind the proxy.
    if (vignoEnabled() && !url.startsWith("file:")) {
      const demo = await registerDemo(lead, url);
      patch.upstreamUrl = url;
      patch.demoToken = demo.token;
      patch.liveUrl = url = demo.url;
    }
    log(`deploy: ${lead.name} -> ${url}`);
    store.advance(lead, "deployed", patch);
  });

  await stage(store, "deployed", n, async (lead) => {
    const { file, subject } = draftPitch(cfg, lead, lead.liveUrl);
    log(`pitch: ${lead.name} — draft ready: ${file}`);
    log(`pitch:   subject: ${subject}`);
    const patch = { pitchFile: file };
    if (vignoEnabled()) {
      try {
        patch.vignoLeadId = await pushLead(lead, lead.liveUrl);
        log(`crm: ${lead.name} -> vigno.ca CRM (lead ${patch.vignoLeadId})`);
      } catch (err) {
        log(`crm: vigno sync failed for ${lead.name} — ${err.message} (lead kept locally)`);
      }
    }
    store.advance(lead, "pitched", patch);
  });

  // 3. CRM housekeeping: surface due follow-ups and draft the nudges.
  const crm = crmReport(store);
  for (const { lead, touchN } of crm.due) {
    if (touchN > 1 && !lead[`touch${touchN}Drafted`]) {
      const file = draftFollowup(cfg, lead, touchN);
      store.advance(lead, lead.status, { [`touch${touchN}Drafted`]: true });
      log(`crm: ${lead.name} — touch ${touchN} due, draft ready: ${file}`);
    }
  }
  if (crm.due.length) log(`crm: ${crm.due.length} follow-up(s) due — see "websmith crm"`);

  // 4. Automatic outreach (only when fully configured and acknowledged).
  if (cfg.outreach?.autoSend) {
    const readiness = autoSendReady(cfg);
    if (!readiness.ready) log(`outreach: autoSend on but not ready — missing: ${readiness.missing.join(", ")}`);
    else {
      const sent = await runOutreach(cfg, store);
      if (sent) log(`outreach: ${sent} email(s) sent this cycle`);
    }
  }

  return store.summary();
}

async function stage(store, status, n, fn) {
  const batch = store.leads.filter((l) => l.status === status).slice(0, n);
  await Promise.all(batch.map(async (lead) => {
    try {
      await fn(lead);
    } catch (err) {
      log(`${status}: ${lead.name} failed — ${err.message}`);
      store.advance(lead, "failed", { error: err.message });
    }
  }));
}

const DAY_MS = 86400000;

export async function runDaemon(cfg) {
  log(`daemon: starting — one cycle every ${cfg.daemonIntervalSeconds}s. Ctrl-C to stop.`);
  let lastUpdateCheck = 0;
  for (;;) {
    // Once a day, pull the latest code. Only source files change; config,
    // leads, built sites and drafts are untouched. A failure never stops
    // the pipeline — it just logs and carries on with the current version.
    if (cfg.autoUpdate && Date.now() - lastUpdateCheck > DAY_MS) {
      lastUpdateCheck = Date.now();
      try {
        const { selfUpdate } = await import("./update.js");
        const { updated } = await selfUpdate(cfg);
        if (updated) {
          log("daemon: new version installed — restarting to load it");
          process.exit(0); // launchd/KeepAlive restarts us on the new code
        }
      } catch (err) {
        log(`daemon: auto-update skipped — ${err.message.split("\n")[0]}`);
      }
    }
    const summary = await runCycle(cfg);
    log(`daemon: cycle done — ${JSON.stringify(summary.counts)}`);
    await sleep(cfg.daemonIntervalSeconds * 1000);
  }
}

export function statusReport(cfg) {
  const store = new Store(cfg.dataDir);
  const summary = store.summary();
  const lines = [`${summary.total} lead(s): ${JSON.stringify(summary.counts)}`, ""];
  for (const l of store.leads) {
    const score = l.score != null ? ` ${String(l.score).padStart(3)}pt` : "";
    lines.push(`  [${l.status.padEnd(8)}]${score} ${l.name} (${l.slug})${l.liveUrl ? ` -> ${l.liveUrl}` : ""}`);
  }
  return lines.join("\n");
}

export { Store };
