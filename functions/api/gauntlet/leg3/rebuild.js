// functions/api/gauntlet/leg3/rebuild.js

/**
 * Cloudflare Pages Function
 *
 * URL:
 *   POST https://ballsville.pages.dev/api/gauntlet/leg3/rebuild
 *
 * Used by:
 *   - cron-job.org (scheduled, external HTTP)
 *   - You (manual curl/PowerShell, with ?force=1 if needed)
 *
 * Behavior:
 *   - Checks "game window" in America/Detroit.
 *   - If outside game window and not forced → no-op, returns { skipped: true }.
 *   - If inside game window OR forced → triggers GitHub Actions workflow_dispatch
 *     for "Build Gauntlet Leg 3" workflow.
 */

function isGameWindow(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value; // "Sun", "Mon", ...
  const hourStr = parts.find((p) => p.type === "hour")?.value || "00";
  const hour = parseInt(hourStr, 10); // 0–23

  // Sunday window: 13:00–23:59
  if (weekday === "Sun" && hour >= 13) return true;

  // Monday window: 20:00–23:59
  if (weekday === "Mon" && hour >= 20) return true;

  // Thursday window: 20:00–23:59
  if (weekday === "Thu" && hour >= 20) return true;

  // Early-morning spillover (0–1) after late games:
  // Mon/Tue/Fri 00:00–01:59
  if ((weekday === "Mon" || weekday === "Tue" || weekday === "Fri") && hour <= 1) {
    return true;
  }

  return false;
}

async function triggerGithubWorkflow(env) {
  const repo = env.GITHUB_REPO;              // e.g. "spickworth1991/ballsville"
  const workflowFile = env.GAUNTLET_WORKFLOW_FILE; // e.g. "build-gauntlet-leg3.yml"
  const token = env.GITHUB_TOKEN;            // PAT with workflow permissions
  const ref = env.GAUNTLET_REF || "main";    // branch to run on

  if (!repo || !workflowFile || !token) {
    throw new Error(
      "Missing GITHUB_REPO, GAUNTLET_WORKFLOW_FILE, or GITHUB_TOKEN in Cloudflare env."
    );
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;

  const body = {
    ref,
    inputs: {
      triggerSource: "cloudflare-leg3",
    },
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GitHub workflow_dispatch failed: ${res.status} ${res.statusText} – ${text}`
    );
  }

  return { repo, workflowFile, ref };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  const inWindow = isGameWindow(now);

  return new Response(
    JSON.stringify({
      ok: true,
      message:
        "Use POST to trigger the Build Gauntlet Leg 3 GitHub workflow. This GET is for sanity checks.",
      now: now.toISOString(),
      inGameWindow: inWindow,
      forceSuggested: !inWindow,
      forceParamExample: "/api/gauntlet/leg3/rebuild?force=1",
      forced: force,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const now = new Date();
    const inWindow = isGameWindow(now);

    if (!inWindow && !force) {
      // Outside game window → clean no-op
      return new Response(
        JSON.stringify({
          ok: true,
          triggered: false,
          skipped: true,
          reason: "Outside configured game window",
          now: now.toISOString(),
          inGameWindow: inWindow,
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
        now: now.toISOString(),
        inGameWindow: inWindow,
        force,
        github: info,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ [CF Function] Error triggering Gauntlet Leg 3 workflow:", err);
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
