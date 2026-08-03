import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../util.js";

const PROMPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../prompts");

// Tools the headless builder may use. Skill lets Claude Code invoke the vendored
// skills in .claude/skills/; the brief also cites them by path so the codex
// engine (no Skill tool) reads the same files directly.
const ALLOWED_TOOLS = "Read,Write,Edit,Glob,Grep,Skill";

// Drives an AI coding agent, headless. Runs from the PROJECT ROOT (not the site
// dir) so .claude/skills/ is discoverable, with the target dir named in the prompt.
export async function buildWithAgent(cfg, lead, siteDir, engine = "claude") {
  const brief = readFileSync(join(PROMPTS_DIR, "site-brief.md"), "utf8");
  const prompt = `Target directory: ${relative(cfg.root, siteDir)}/\n\n${brief}`;
  log(`build: running ${engine}${cfg.builderModel ? ` (${cfg.builderModel})` : ""} for ${lead.name} (${siteDir})`);
  await runEngine(engine, prompt, cfg.root, cfg.builderModel);
  if (!existsSync(join(siteDir, "index.html"))) {
    throw new Error(`${engine} finished but produced no index.html in ${siteDir}`);
  }
}

// QA fix pass: hand the agent the QA report and let it repair the site in place.
export async function fixWithAgent(cfg, lead, siteDir, report, engine = "claude") {
  const prompt = `Target directory: ${relative(cfg.root, siteDir)}/

The website in the target directory failed QA review. Fix ONLY these issues, keeping
the existing design intact, then stop. Re-check your fixes against
.claude/skills/design-review/SKILL.md and keep all copy compliant with
.claude/skills/stop-slop/SKILL.md.

Issues:
${report.issues.map((i) => `- ${i}`).join("\n")}
${report.warnings.length ? `\nWarnings (fix if quick):\n${report.warnings.map((w) => `- ${w}`).join("\n")}` : ""}

The site must remain fully self-contained (no external scripts/stylesheets) with
index.html as the entry point. Do not modify anything outside the target directory.`;
  await runEngine(engine, prompt, cfg.root, cfg.builderModel);
}

function runEngine(engine, prompt, cwd, model = "") {
  const claudeArgs = ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED_TOOLS];
  if (model) claudeArgs.push("--model", model);
  const [cmd, args] = engine === "codex"
    ? ["codex", ["exec", "--full-auto", "--cd", cwd, prompt]]
    : ["claude", claudeArgs];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (err) =>
      reject(err.code === "ENOENT"
        ? new Error(`"${cmd}" CLI not found on PATH. Install it or set builder: "template".`)
        : err));
    child.on("exit", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${cmd} exited with code ${code}`)));
  });
}
