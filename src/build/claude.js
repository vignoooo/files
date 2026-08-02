import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../util.js";

const PROMPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../prompts");

// Drives an AI coding agent, headless, inside the lead's site directory.
// engine: "claude" -> `claude -p`, "codex" -> `codex exec`.
export async function buildWithAgent(cfg, lead, siteDir, engine = "claude") {
  const brief = readFileSync(join(PROMPTS_DIR, "site-brief.md"), "utf8");
  const argv = engine === "codex"
    ? ["codex", ["exec", "--full-auto", "--cd", siteDir, brief]]
    : ["claude", ["-p", brief, "--permission-mode", "acceptEdits", "--allowedTools", "Read,Write,Edit,Glob,Grep"]];

  log(`build: running ${engine} for ${lead.name} (${siteDir})`);
  await run(argv[0], argv[1], siteDir);

  if (!existsSync(join(siteDir, "index.html"))) {
    throw new Error(`${engine} finished but produced no index.html in ${siteDir}`);
  }
}

function run(cmd, args, cwd) {
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
