import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { readJson } from "./util.js";

// Minimal .env loader (zero-dep): KEY=value lines, # comments, no expansion.
// Existing environment variables always win.
export function loadEnv(root = process.cwd()) {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

const DEFAULTS = {
  // Where to hunt for businesses, e.g. "Sherbrooke, QC" or "Lisbon, Portugal"
  region: "",
  // Business categories to target, in priority order
  categories: ["restaurant", "barber", "bakery", "plumber", "florist", "auto repair"],
  // "google" (needs GOOGLE_MAPS_API_KEY) or "overpass" (free, OpenStreetMap)
  prospector: "overpass",
  // "claude" (headless Claude Code), "codex" (codex exec), or "template" (built-in, no AI)
  builder: "claude",
  // "none" (local preview only), "vercel", or "netlify"
  deployer: "none",
  // Also target businesses whose existing website is outdated (google prospector only)
  includeOutdated: true,
  // Leads to process concurrently per stage ("Run pipeline x3" -> 3)
  parallel: 1,
  // Path to a Chromium/Chrome binary for QA screenshots (auto-detected if empty)
  chromePath: "",
  // Max photos to download per business
  maxPhotos: 6,
  // Language for site copy and the pitch ("en", "fr", ...)
  language: "en",
  // Operator identity, used to sign pitch drafts
  operator: { name: "", email: "", company: "", url: "" },
  // Extra styling/brand direction passed to the site builder
  designNotes: "",
  // Seconds between pipeline cycles in daemon mode
  daemonIntervalSeconds: 3600,
  // Directories (relative to project root)
  dataDir: "data",
  sitesDir: "sites",
  outboxDir: "outbox"
};

export function loadConfig(root = process.cwd()) {
  loadEnv(root);
  const file = readJson(resolve(root, "websmith.config.json"), {});
  const cfg = { ...DEFAULTS, ...file, operator: { ...DEFAULTS.operator, ...(file.operator || {}) } };
  cfg.root = root;
  cfg.dataDir = resolve(root, cfg.dataDir);
  cfg.sitesDir = resolve(root, cfg.sitesDir);
  cfg.outboxDir = resolve(root, cfg.outboxDir);
  cfg.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  return cfg;
}

export { DEFAULTS };
