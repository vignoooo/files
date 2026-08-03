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

// Rotation used when regions is set to "quebec" — one region per cycle,
// round-robin, so the whole province gets covered without touching config.
export const QUEBEC_REGIONS = [
  "Montréal, QC", "Québec, QC", "Laval, QC", "Gatineau, QC", "Longueuil, QC",
  "Sherbrooke, QC", "Lévis, QC", "Trois-Rivières, QC", "Terrebonne, QC",
  "Saguenay, QC", "Brossard, QC", "Repentigny, QC", "Drummondville, QC",
  "Saint-Jérôme, QC", "Granby, QC", "Blainville, QC", "Saint-Hyacinthe, QC",
  "Shawinigan, QC", "Rimouski, QC", "Victoriaville, QC", "Joliette, QC",
  "Salaberry-de-Valleyfield, QC", "Rouyn-Noranda, QC", "Sorel-Tracy, QC",
  "Magog, QC", "Alma, QC", "Saint-Georges, QC", "Sept-Îles, QC"
];

const DEFAULTS = {
  // Where to hunt for businesses, e.g. "Sherbrooke, QC" or "Lisbon, Portugal"
  region: "",
  // Rotate through many regions, one per cycle: a list of region strings, or
  // the shortcut "quebec" for the built-in province-wide list. Empty = use
  // `region` only.
  regions: [],
  // Business categories to target, in priority order — or "all" for every
  // category websmith knows how to find
  categories: ["restaurant", "barber", "bakery", "plumber", "florist", "auto repair"],
  // "google" (needs GOOGLE_MAPS_API_KEY) or "overpass" (free, OpenStreetMap)
  prospector: "overpass",
  // "claude" (headless Claude Code), "codex" (codex exec), or "template" (built-in, no AI)
  builder: "claude",
  // Model for the claude builder ("opus" strongly recommended on a Max plan —
  // it's the single biggest site-quality lever). Empty = CLI default.
  builderModel: "opus",
  // "none" (local preview only), "vercel", or "netlify"
  deployer: "none",
  // Also target businesses whose existing website is outdated (google prospector only)
  includeOutdated: true,
  // Only build for businesses with a published email address to pitch to.
  // Checked during enrich, BEFORE the build — leads without one are skipped
  // instead of burning a build on a site that can't be sent anywhere.
  requireEmail: true,
  // Leads to process concurrently per stage ("Run pipeline x3" -> 3)
  parallel: 1,
  // Path to a Chromium/Chrome binary for QA screenshots (auto-detected if empty)
  chromePath: "",
  // Max photos to download per business
  maxPhotos: 6,
  // Language for site copy and the pitch ("en", "fr", ...)
  language: "en",
  // Operator identity, used to sign pitch drafts. `address` is the real
  // mailing address CASL/CAN-SPAM require in commercial email; auto-send
  // refuses to run without it.
  operator: { name: "", email: "", company: "", url: "", address: "" },
  // Automatic outreach — OFF by default. See README "Auto-send" before
  // enabling; caslAcknowledged must also be set to true.
  outreach: { autoSend: false, dailyCap: 15, windowHours: [9, 17] },
  caslAcknowledged: false,
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
  const cfg = {
    ...DEFAULTS,
    ...file,
    operator: { ...DEFAULTS.operator, ...(file.operator || {}) },
    outreach: { ...DEFAULTS.outreach, ...(file.outreach || {}) }
  };
  if (typeof cfg.regions === "string") {
    const key = cfg.regions.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    cfg.regions = key === "quebec" ? QUEBEC_REGIONS : [cfg.regions];
  }
  cfg.root = root;
  cfg.dataDir = resolve(root, cfg.dataDir);
  cfg.sitesDir = resolve(root, cfg.sitesDir);
  cfg.outboxDir = resolve(root, cfg.outboxDir);
  cfg.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  return cfg;
}

export { DEFAULTS };
