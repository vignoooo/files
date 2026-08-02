import { resolve } from "node:path";
import { readJson } from "./util.js";

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
  operator: { name: "", email: "" },
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
