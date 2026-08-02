#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { loadConfig, DEFAULTS } from "../src/config.js";
import { runCycle, runDaemon, statusReport, Store } from "../src/pipeline.js";
import { writeJson, log } from "../src/util.js";

const [, , command, ...rest] = process.argv;

const HELP = `websmith — an autonomous website agency pipeline

Usage:
  websmith init                 Create websmith.config.json in the current directory
  websmith run                  Run one full pipeline cycle (prospect -> enrich -> build -> deploy -> pitch)
  websmith daemon               Run cycles continuously on the configured interval
  websmith status               Show every lead and its stage
  websmith preview <slug>       Serve a built site locally on http://localhost:8787
  websmith retry <slug>         Reset a failed lead to its last good stage

Configure via websmith.config.json (see README). Google prospecting needs
GOOGLE_MAPS_API_KEY in the environment; the default OpenStreetMap prospector is free.
`;

async function main() {
  const cfg = loadConfig();
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
      if (!cfg.region) throw new Error('No region configured. Run "websmith init" and set "region".');
      const summary = await runCycle(cfg);
      log(`cycle complete — ${JSON.stringify(summary.counts)}`);
      break;
    }
    case "daemon": {
      if (!cfg.region) throw new Error('No region configured. Run "websmith init" and set "region".');
      await runDaemon(cfg);
      break;
    }
    case "status":
      console.log(statusReport(cfg));
      break;
    case "preview": {
      const slug = rest[0];
      if (!slug) throw new Error("Usage: websmith preview <slug>");
      const dir = join(cfg.sitesDir, slug);
      if (!existsSync(join(dir, "index.html"))) throw new Error(`No built site at ${dir}`);
      await serve(dir);
      break;
    }
    case "retry": {
      const store = new Store(cfg.dataDir);
      const lead = store.get(rest[0] || "");
      if (!lead) throw new Error(`No lead "${rest[0]}". Try: websmith status`);
      const back = lead.liveUrl ? "deployed" : existsSync(join(cfg.sitesDir, lead.slug, "index.html")) ? "built" : lead.siteDir ? "enriched" : "new";
      store.advance(lead, back, { error: undefined });
      log(`${lead.name} reset to "${back}" — run: websmith run`);
      break;
    }
    default:
      console.log(HELP);
      process.exitCode = command && command !== "help" ? 1 : 0;
  }
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
