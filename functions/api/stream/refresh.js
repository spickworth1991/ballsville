import { readStreamSession, streamJson } from "../../_lib/streamAuth.js";

export async function onRequestPost({ request, env }) {
  const user = await readStreamSession(request, env);
  if (!user) return streamJson({ error: "Unauthorized" }, 401);
  const repo = env.GITHUB_REPO;
  const workflow = env.STREAM_WORKFLOW_FILE || "update-stream-data.yml";
  const token = env.GH_WORKFLOW_TOKEN;
  const ref = env.STREAM_WORKFLOW_REF || env.LEADERBOARDS_REF || "main";
  if (!repo || !token) return streamJson({ error: "GITHUB_REPO or GH_WORKFLOW_TOKEN is not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch {}
  const kind = body?.kind === "injuries" ? "injuries" : "trades";
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      "user-agent": "BallsvilleStream/1.0",
    },
    body: JSON.stringify({ ref, inputs: { kind } }),
  });
  if (!response.ok) return streamJson({ error: `Workflow dispatch failed (${response.status}): ${await response.text()}` }, 502);
  return streamJson({ ok: true, queued: true, kind, requestedBy: user.name });
}
