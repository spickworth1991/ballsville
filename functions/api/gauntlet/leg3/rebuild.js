// functions/api/gauntlet/leg3/rebuild.js

/**
 * Cloudflare Pages Function that:
 *   - Optionally respects an NFL "game window" (like the Node script)
 *   - Triggers the GitHub Actions workflow that runs scripts/buildgauntlet.mjs
 *
 * Flow:
 *   cron-job.org  →  this function  →  GitHub workflow_dispatch  →  buildgauntlet.mjs
 *
 * Env vars (set in Cloudflare project settings):
 *   - GITHUB_REPO               e.g. "spickworth1991/ballsville"
 *   - GAUNTLET_WORKFLOW_FILE    e.g. "build-gauntlet-leg3.yml"
 *   - GAUNTLET_REF              e.g. "main" (optional, defaults to "main")
 *   - GITHUB_TOKEN              PAT with "repo" + "workflow" scopes
 */

const GAME_TZ = "America/Detroit";

/**
 * Rough "NFL game time" window in Eastern Time (America/Detroit):
 *  - Thursday: 19:00–23:59
 *  - Sunday:   13:00–23:59
 *  - Monday:   19:00–23:59
 *  - Plus spillover 00:00–01:00 after late games on Mon/Tue/Fri
 *
 * This doesn't have to be perfect; it just avoids hammering during truly dead times.
 */
function isGameWindow(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: GAME_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const time = hour + minute / 60; // decimal hour

  // Saturday window: 16:30+
  if (weekday === "Sat" && time >= 16.5) return true;

  // Sunday window: 12:30+
  if (weekday === "Sun" && time >= 12.5) return true;

  // Monday window: 19:00+
  if (weekday === "Mon" && time >= 19) return true;

  // Thursday window: 19:00+
  if (weekday === "Thu" && time >= 15) return true;

  // Early-morning spillover (00:00–01:59)
  if (
    (weekday === "Mon" || weekday === "Tue" || weekday === "Fri") &&
    time < 2
  ) {
    return true;
  }

  return false;
}


/**
 * Trigger the GitHub Actions workflow via workflow_dispatch.
 *
 * We only send `{ ref }` – no "inputs" – to avoid 422 errors like:
 *   "Unexpected inputs provided: [\"triggerSource\"]"
 */
async function triggerGithubWorkflow(env) {
  const repo = env.GITHUB_REPO;              // e.g. "spickworth1991/ballsville"
  const workflowFile = env.GAUNTLET_WORKFLOW_FILE; // e.g. "build-gauntlet-leg3.yml"
  const token = env.GH_WORKFLOW_TOKEN;            // PAT with workflow permissions
  const ref = env.GAUNTLET_REF || "main";         // branch name

  if (!repo || !workflowFile || !token) {
    throw new Error(
      "Missing GITHUB_REPO, GAUNTLET_WORKFLOW_FILE, or GITHUB_TOKEN in Cloudflare env."
    );
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;
  console.log("Triggering GitHub workflow:", url, "ref:", ref);

  const body = {
    ref,
    // ❌ No "inputs" here; your workflow_dispatch has no inputs defined.
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "ballsville-gauntlet-leg3-cf-function",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `GitHub workflow_dispatch failed: ${res.status} ${res.statusText} – ${text}`
    );
  }

  console.log("GitHub workflow_dispatch OK:", text || "<empty body>");

  return { repo, workflowFile, ref };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    // ⏱ Respect game window unless forced
    if (!force && !isGameWindow()) {
      console.log(
        "⏭️  Outside game window; not triggering GitHub workflow. " +
          "Use ?force=1 to override."
      );
      return new Response(
        JSON.stringify({
          ok: true,
          triggered: false,
          skipped: true,
          reason: "outside_game_window",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const info = await triggerGithubWorkflow(env);

    return new Response(
      JSON.stringify({
        ok: true,
        triggered: true,
        skipped: false,
        workflow: info,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ [CF] Gauntlet Leg 3 workflow trigger error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        triggered: false,
        skipped: false,
        error: err?.message || "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Optional GET sanity check
export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      message:
        "POST here to trigger the Gauntlet Leg 3 GitHub workflow. Use ?force=1 to ignore game-time checks.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
