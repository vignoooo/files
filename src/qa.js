import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeJson, log } from "./util.js";

const execFileP = promisify(execFile);

// QA stage: static checks every build must pass, plus desktop/mobile
// screenshots (when a Chromium is available) for the fresh-eyes review agent.
// Returns { passed, issues, warnings, screenshots }.
export async function runQa(cfg, lead, siteDir) {
  const issues = [];
  const warnings = [];
  const indexPath = join(siteDir, "index.html");

  if (!existsSync(indexPath)) {
    return finish(siteDir, { passed: false, issues: ["index.html is missing"], warnings, screenshots: [] });
  }
  const html = readFileSync(indexPath, "utf8");

  if (html.length < 500) issues.push("index.html is suspiciously small");
  if (!/<title>[^<]{2,}/i.test(html)) issues.push("missing <title>");
  if (!/name=["']viewport["']/i.test(html)) issues.push("missing viewport meta (not mobile-ready)");
  if (!/name=["']description["']/i.test(html)) warnings.push("missing meta description");
  if (!/<html[^>]+lang=/i.test(html)) warnings.push("missing lang attribute on <html>");
  if (!html.includes(lead.name.split(" ")[0])) issues.push("business name not found in the page");

  // Every local file referenced must exist on disk.
  for (const m of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/i.test(ref)) continue;
    if (!existsSync(join(siteDir, ref.split("?")[0]))) issues.push(`broken local reference: ${ref}`);
  }

  // <img> without alt text fails accessibility.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt=/i.test(m[0])) warnings.push(`img missing alt: ${m[0].slice(0, 60)}...`);
  }

  // External JS/CSS dependencies violate the self-contained rule.
  if (/<script[^>]+src=["']https?:\/\//i.test(html)) issues.push("external script dependency (must be self-contained)");
  if (/<link[^>]+href=["']https?:\/\/[^"']*\.css/i.test(html)) warnings.push("external stylesheet dependency");

  const screenshots = await capture(cfg, indexPath, siteDir);
  return finish(siteDir, { passed: issues.length === 0, issues, warnings, screenshots });
}

function finish(siteDir, report) {
  writeJson(join(siteDir, "qa-report.json"), report);
  return report;
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

async function capture(cfg, indexPath, siteDir) {
  const chrome = (cfg.chromePath ? [cfg.chromePath] : CHROME_CANDIDATES).find((p) => existsSync(p));
  if (!chrome) {
    log("qa: no Chromium found — skipping screenshots (static checks only)");
    return [];
  }
  const qaDir = join(siteDir, "qa");
  mkdirSync(qaDir, { recursive: true });
  const shots = [];
  for (const [name, size] of [["desktop", "1280,900"], ["mobile", "390,844"]]) {
    const out = join(qaDir, `${name}.png`);
    try {
      await execFileP(chrome, [
        "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        `--screenshot=${out}`, `--window-size=${size}`, `file://${indexPath}`
      ], { timeout: 30000 });
      shots.push(out);
    } catch (err) {
      log(`qa: ${name} screenshot failed — ${err.message}`);
    }
  }
  return shots;
}
