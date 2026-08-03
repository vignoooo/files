import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { log } from "./util.js";

const run = promisify(execFile);

export const REPO = "https://github.com/vignoooo/files.git";
export const BRANCH = "claude/klaudius-bot-app-agent-8qy07c";

// Files that are tracked in git but which the operator may have edited.
// They're preserved across an update and restored afterwards.
const PROTECTED = ["memory.md"];

// Updates the project in place from GitHub, keeping everything that is
// yours: .env, websmith.config.json, data/, sites/, outbox/ and logs/ are
// gitignored, so they are never touched. memory.md is backed up and restored.
export async function selfUpdate(cfg, { repo = REPO, branch = BRANCH } = {}) {
  const root = cfg.root;
  const git = (...args) => run("git", args, { cwd: root });

  if (!(await hasGit())) {
    throw new Error('git is not installed. Install Xcode command line tools with:\n  xcode-select --install');
  }

  // A ZIP download has no git metadata — convert it into a real clone once,
  // in place, without disturbing untracked files.
  if (!existsSync(join(root, ".git"))) {
    log("update: first run — linking this folder to the repository...");
    await git("init");
    await git("remote", "add", "origin", repo);
  } else {
    await git("remote", "set-url", "origin", repo).catch(async () => {
      await git("remote", "add", "origin", repo);
    });
  }

  // Keep backups outside the project: the cleanup below removes untracked
  // files, and a backup sitting in the folder would be swept away with them.
  const safe = mkdtempSync(join(tmpdir(), "websmith-update-"));
  const backups = [];
  for (const file of PROTECTED) {
    const path = join(root, file);
    if (existsSync(path)) {
      copyFileSync(path, join(safe, file));
      backups.push(file);
    }
  }

  log(`update: fetching ${branch}...`);
  try {
    await git("fetch", "--depth", "1", "origin", branch);
  } catch (err) {
    throw new Error(authHint(err));
  }

  const before = await headSha(git);
  await git("checkout", "-f", "-B", branch, "FETCH_HEAD");
  // Sweep leftovers from the previous version. -d without -x means ignored
  // paths (.env, websmith.config.json, data/, sites/, outbox/, logs/) are
  // left completely alone.
  await git("clean", "-fd").catch(() => {});
  const after = await headSha(git);

  // Restore protected files, keeping the operator's version and leaving the
  // incoming one alongside for comparison.
  for (const file of backups) {
    const path = join(root, file);
    if (existsSync(path)) copyFileSync(path, `${path}.incoming`);
    copyFileSync(join(safe, file), path);
    log(`update: kept your ${file} (new version saved as ${file}.incoming)`);
  }
  rmSync(safe, { recursive: true, force: true });

  if (before && before === after) {
    log("update: already up to date.");
    return { updated: false };
  }
  log(`update: updated to ${after.slice(0, 8)} — run "websmith doctor" to confirm.`);
  return { updated: true, sha: after };
}

async function hasGit() {
  try { await run("git", ["--version"]); return true; } catch { return false; }
}

async function headSha(git) {
  try { return (await git("rev-parse", "HEAD")).stdout.trim(); } catch { return null; }
}

function authHint(err) {
  const msg = String(err.stderr || err.message);
  if (/authentication|denied|not found|could not read/i.test(msg)) {
    return `could not reach the repository — GitHub needs to know it's you.
One-time fix, whichever you prefer:
  1) brew install gh && gh auth login       (easiest; then re-run update)
  2) create a token at github.com/settings/tokens (repo scope) and run:
     git -C . remote set-url origin https://<TOKEN>@github.com/vignoooo/files.git

Original error: ${msg.trim().split("\n")[0]}`;
  }
  return `fetch failed: ${msg.trim().split("\n")[0]}`;
}
