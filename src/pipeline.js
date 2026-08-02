import { join } from "node:path";
import { Store } from "./store.js";
import { prospectGoogle } from "./prospect/google.js";
import { prospectOverpass } from "./prospect/overpass.js";
import { enrich } from "./enrich.js";
import { buildWithAgent, fixWithAgent } from "./build/claude.js";
import { buildWithTemplate } from "./build/template.js";
import { runQa } from "./qa.js";
import { deploySite } from "./deploy/index.js";
import { draftPitch } from "./pitch.js";
import { crmReport, draftFollowup } from "./crm.js";
import { log, sleep } from "./util.js";

// One full cycle: top up leads, then march every stage forward.
// cfg.parallel controls how many leads move through each stage concurrently.
export async function runCycle(cfg, { prospectLimit = 3 } = {}) {
  const store = new Store(cfg.dataDir);
  const n = Math.max(1, cfg.parallel | 0);

  // 1. Prospect — only when the funnel has nothing waiting.
  if (!store.nextWithStatus("new")) {
    log(`prospect: hunting in "${cfg.region}"...`);
    try {
      const found = cfg.prospector === "google"
        ? await prospectGoogle(cfg, { limit: Math.max(prospectLimit, n) })
        : await prospectOverpass(cfg, { limit: Math.max(prospectLimit, n) });
      let added = 0;
      for (const lead of found) if (store.add(lead)) added++;
      log(`prospect: ${found.length} candidates (ranked), ${added} new leads added`);
    } catch (err) {
      log(`prospect: failed — ${err.message}`);
    }
  }

  await stage(store, "new", n, async (lead) => {
    const { siteDir, photos } = await enrich(cfg, lead);
    log(`enrich: ${lead.name} — workspace ready, ${photos} photo(s)`);
    store.advance(lead, "enriched", { siteDir });
  });

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
    const url = await deploySite(cfg, lead, lead.siteDir);
    log(`deploy: ${lead.name} -> ${url}`);
    store.advance(lead, "deployed", { liveUrl: url });
  });

  await stage(store, "deployed", n, async (lead) => {
    const { file, subject } = draftPitch(cfg, lead, lead.liveUrl);
    log(`pitch: ${lead.name} — draft ready: ${file}`);
    log(`pitch:   subject: ${subject}`);
    store.advance(lead, "pitched", { pitchFile: file });
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

export async function runDaemon(cfg) {
  log(`daemon: starting — one cycle every ${cfg.daemonIntervalSeconds}s. Ctrl-C to stop.`);
  for (;;) {
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
