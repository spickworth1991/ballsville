import { streamJson } from "../../_lib/streamAuth.js";

const TIME_ZONE = "America/New_York";
const LOCK_PREFIX = "data/stream/scheduler/dispatches";

function easternParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday"), date: `${get("year")}-${get("month")}-${get("day")}` };
}

export function streamSchedule(now = new Date()) {
  const local = easternParts(now);
  const inSeason = local.month <= 2 || local.month >= 8;
  return { ...local, cadence: inSeason ? "daily" : "weekly", due: inSeason || local.weekday === "Mon", reason: inSeason || local.weekday === "Mon" ? null : "offseason_updates_run_mondays" };
}

export function nextEligibleDate(now = new Date()) {
  for (let offset = 1; offset <= 8; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const schedule = streamSchedule(candidate);
    if (schedule.due) return schedule.date;
  }
  return null;
}

async function sameSecret(supplied, configured) {
  if (!supplied || !configured) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(supplied)), crypto.subtle.digest("SHA-256", encoder.encode(configured))]);
  const left = new Uint8Array(a); const right = new Uint8Array(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function handleStreamRebuild({ request, env, now = new Date() }) {
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!await sameSecret(supplied, String(env.STREAM_CRON_SECRET || "").trim())) return streamJson({ ok: false, error: "Unauthorized stream scheduler request." }, 401);
  const schedule = streamSchedule(now);
  const nextUpdate = nextEligibleDate(now);
  if (!schedule.due) return streamJson({ ok: true, triggered: false, skipped: true, reason: schedule.reason, cadence: schedule.cadence, localDate: schedule.date, nextUpdate });

  const bucket = env.ADMIN_BUCKET || env.admin_bucket;
  if (!bucket?.get || !bucket?.put) return streamJson({ ok: false, error: "Existing R2 admin bucket binding is unavailable." }, 500);
  const lockKey = `${LOCK_PREFIX}/${schedule.date}.json`;
  const existing = await bucket.get(lockKey);
  if (existing) return streamJson({ ok: true, triggered: false, skipped: true, reason: "already_dispatched", cadence: schedule.cadence, localDate: schedule.date, nextUpdate });

  const repo = env.GITHUB_REPO;
  const workflow = env.STREAM_WORKFLOW_FILE || "update-stream-data.yml";
  const token = env.GH_WORKFLOW_TOKEN;
  const ref = env.STREAM_WORKFLOW_REF || env.LEADERBOARDS_REF || "main";
  if (!repo || !token) return streamJson({ ok: false, error: "GITHUB_REPO or GH_WORKFLOW_TOKEN is not configured." }, 500);
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "BallsvilleStreamScheduler/1.0" },
    body: JSON.stringify({ ref, inputs: { kind: "scheduled", full_rebuild: "false" } }),
  });
  if (!response.ok) return streamJson({ ok: false, error: `Workflow dispatch failed (${response.status}): ${await response.text()}` }, 502);
  await bucket.put(lockKey, JSON.stringify({ dispatchedAt: now.toISOString(), localDate: schedule.date, cadence: schedule.cadence, workflow, ref }), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return streamJson({ ok: true, triggered: true, skipped: false, cadence: schedule.cadence, localDate: schedule.date, nextUpdate, workflow: { file: workflow, ref, kind: "scheduled" } });
}

export async function onRequestGet(context) {
  return handleStreamRebuild(context);
}
