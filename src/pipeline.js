import { join } from "node:path";
import { Store } from "./store.js";
import { prospectGoogle } from "./prospect/google.js";
import { prospectOverpass } from "./prospect/overpass.js";
import { enrich } from "./enrich.js";
import { buildWithAgent } from "./build/claude.js";
import { buildWithTemplate } from "./build/template.js";
import { deploySite } from "./deploy/index.js";
import { draftPitch } from "./pitch.js";
import { log, sleep } from "./util.js";

// One full cycle: top up leads, then walk every lead one step forward.
export async function runCycle(cfg, { prospectLimit = 3 } = {}) {
  const store = new Store(cfg.dataDir);

  // 1. Prospect — only when nothing is waiting in the funnel.
  if (!store.nextWithStatus("new")) {
    log(`prospect: hunting for businesses without websites in "${cfg.region}"...`);
    try {
      const found = cfg.prospector === "google"
        ? await prospectGoogle(cfg, { limit: prospectLimit })
        : await prospectOverpass(cfg, { limit: prospectLimit });
      let added = 0;
      for (const lead of found) if (store.add(lead)) added++;
      log(`prospect: ${found.length} candidates, ${added} new leads added`);
    } catch (err) {
      log(`prospect: failed — ${err.message}`);
    }
  }

  // 2. March each stage forward. One lead per stage per cycle keeps output steady.
  await step(store, "new", async (lead) => {
    const { siteDir, photos } = await enrich(cfg, lead);
    log(`enrich: ${lead.name} — workspace ready, ${photos} photo(s)`);
    store.advance(lead, "enriched", { siteDir });
  });

  await step(store, "enriched", async (lead) => {
    if (cfg.builder === "template") buildWithTemplate(cfg, lead, lead.siteDir);
    else await buildWithAgent(cfg, lead, lead.siteDir, cfg.builder);
    log(`build: ${lead.name} — site generated (${cfg.builder})`);
    store.advance(lead, "built");
  });

  await step(store, "built", async (lead) => {
    const url = await deploySite(cfg, lead, lead.siteDir);
    log(`deploy: ${lead.name} -> ${url}`);
    store.advance(lead, "deployed", { liveUrl: url });
  });

  await step(store, "deployed", async (lead) => {
    const { file, subject } = draftPitch(cfg, lead, lead.liveUrl);
    log(`pitch: ${lead.name} — draft ready: ${file}`);
    log(`pitch:   subject: ${subject}`);
    store.advance(lead, "pitched", { pitchFile: file });
  });

  return store.summary();
}

async function step(store, status, fn) {
  const lead = store.nextWithStatus(status);
  if (!lead) return;
  try {
    await fn(lead);
  } catch (err) {
    log(`${status}: ${lead.name} failed — ${err.message}`);
    store.advance(lead, "failed", { error: err.message });
  }
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
    lines.push(`  [${l.status.padEnd(8)}] ${l.name} (${l.slug})${l.liveUrl ? ` -> ${l.liveUrl}` : ""}`);
  }
  return lines.join("\n");
}

export { Store };
