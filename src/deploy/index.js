import { spawn } from "node:child_process";
import { log } from "../util.js";

// Deploys siteDir and returns the live URL (or a local path for "none").
export async function deploySite(cfg, lead, siteDir) {
  switch (cfg.deployer) {
    case "vercel":
      return deployVercel(lead, siteDir);
    case "netlify":
      return deployNetlify(lead, siteDir);
    case "none":
      log(`deploy: skipped (deployer "none") — preview with: websmith preview ${lead.slug}`);
      return `file://${siteDir}/index.html`;
    default:
      throw new Error(`Unknown deployer "${cfg.deployer}" (use none | vercel | netlify).`);
  }
}

async function deployVercel(lead, siteDir) {
  const out = await run("vercel", ["deploy", "--prod", "--yes", "--name", `site-${lead.slug}`], siteDir);
  const url = out.split(/\s+/).reverse().find((w) => w.startsWith("https://"));
  if (!url) throw new Error("vercel finished but printed no deployment URL");
  return url;
}

async function deployNetlify(lead, siteDir) {
  const out = await run("netlify", ["deploy", "--prod", "--dir", ".", "--json"], siteDir);
  const json = JSON.parse(out.slice(out.indexOf("{")));
  const url = json.deploy_url || json.url;
  if (!url) throw new Error("netlify finished but returned no deployment URL");
  return url;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; process.stdout.write(d); });
    child.on("error", (err) =>
      reject(err.code === "ENOENT"
        ? new Error(`"${cmd}" CLI not found on PATH. Install it and log in, or set deployer: "none".`)
        : err));
    child.on("exit", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with code ${code}`)));
  });
}
