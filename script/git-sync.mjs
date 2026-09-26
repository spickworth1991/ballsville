import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const message = process.argv.slice(2).join(" ").trim() || "stream room test";

function git(args, { allowFailure = false, quiet = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
    env: { ...process.env, GIT_EDITOR: "true" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) process.exit(result.status || 1);
  return result;
}

function output(args) {
  return git(args, { allowFailure: true, quiet: true }).stdout?.trim() || "";
}

const rebasePath = output(["rev-parse", "--git-path", "rebase-merge"]);
const rebaseApplyPath = output(["rev-parse", "--git-path", "rebase-apply"]);
const rebaseInProgress =
  (rebasePath && existsSync(rebasePath)) ||
  (rebaseApplyPath && existsSync(rebaseApplyPath));

if (rebaseInProgress) {
  console.error("A conflicted rebase is already in progress. Resolve it or run git rebase --abort before syncing.");
  process.exit(1);
}

const startingBranch = output(["branch", "--show-current"]);
if (!startingBranch) {
  console.error("Cannot sync from a detached HEAD.");
  process.exit(1);
}

console.log("Saving local work...");
git(["add", "-A"]);
const staged = git(["diff", "--cached", "--quiet"], { allowFailure: true, quiet: true });
if (staged.status === 1) git(["commit", "-m", message]);
else if (staged.status > 1) process.exit(staged.status);
else console.log("No uncommitted local changes.");

for (let attempt = 1; attempt <= 3; attempt += 1) {
  console.log("Getting the latest main branch...");
  git(["fetch", "origin", "main"]);

  console.log("Replaying local commits on the latest main...");
  const rebase = git(["rebase", "origin/main"], { allowFailure: true });
  if (rebase.status !== 0) {
    console.error("\nSync stopped because Git found a conflict.");
    console.error("Resolve the files and run git rebase --continue, or cancel with git rebase --abort.");
    process.exit(rebase.status || 1);
  }

  console.log("Pushing directly to main...");
  const push = git(["push", "origin", "HEAD:main"], { allowFailure: true });
  if (push.status === 0) {
    if (startingBranch !== "main") {
      // First-run migration away from the old preview workflow.
      git(["branch", "-f", "main", "HEAD"]);
      git(["switch", "main"]);
    }
    console.log("Local and GitHub main are now synchronized.");
    process.exit(0);
  }

  if (attempt < 3) console.warn(`Remote main changed while syncing; retrying (${attempt}/3)...`);
}

console.error("GitHub main changed repeatedly or rejected the push. Run npm run sync again after checking branch protection.");
process.exit(1);


