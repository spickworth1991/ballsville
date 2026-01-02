// functions/api/leaderboards/rebuild.js

/**
 * Cloudflare Pages Function that triggers the GitHub Actions workflow
 * to rebuild/upload leaderboards JSONs.
 *
 * Designed for cron-job.org (GET pings) or manual (POST).
 *
 * Env vars (Cloudflare project settings):
 *   - GITHUB_REPO                    e.g. "spickworth1991/ballsville"
 *   - LEADERBOARDS_WORKFLOW_FILE     e.g. "update-leaderboards.yml"
 *   - LEADERBOARDS_REF               e.g. "main" (optional, defaults to "main")
 *   - GH_WORKFLOW_TOKEN              PAT with workflow permissions
 */

const GAME_TZ = "America/Detroit";

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
  const time = hour + minute / 60;

  // Sat: 16:30+
  if (weekday === "Sat" && time >= 16.5) return true;
  // Sun: 12:30+
  if (weekday === "Sun" && time >= 12.5) return true;
  // Mon: 19:00+
  if (weekday === "Mon" && time >= 19) return true;
  // Thu: 19:00+
  if (weekday === "Thu" && time >= 19) return true;

  // Early spillover
  if ((weekday === "Mon" || weekday === "Tue" || weekday === "Fri") && time < 2) return true;

  return false;
}

async function triggerGithubWorkflow(env) {
  const repo = env.GITHUB_REPO;
  const workflowFile = env.LEADERBOARDS_WORKFLOW_FILE;
  const token = env.GH_WORKFLOW_TOKEN;
  const ref = env.LEADERBOARDS_REF || "main";

  if (!repo || !workflowFile || !token) {
    throw new Error("Missing GITHUB_REPO, LEADERBOARDS_WORKFLOW_FILE, or GH_WORKFLOW_TOKEN in Cloudflare env.");
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "ballsville-leaderboards-cf-function",
    },
    body: JSON.stringify({ ref }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub workflow_dispatch failed: ${res.status} ${res.statusText} – ${text}`);
  }

  return { repo, workflowFile, ref };
}

async function handleTrigger(request, env) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && !isGameWindow()) {
    return new Response(
      JSON.stringify({ ok: true, triggered: false, skipped: true, reason: "outside_game_window" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const info = await triggerGithubWorkflow(env);
  return new Response(
    JSON.stringify({ ok: true, triggered: true, skipped: false, workflow: info }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// cron-job.org pings GET, so GET triggers by default (same as POST)
export async function onRequestGet({ request, env }) {
  try {
    return await handleTrigger(request, env);
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, triggered: false, error: err?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    return await handleTrigger(request, env);
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, triggered: false, error: err?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
