import fs from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildInjuryData } from "../lib/stream/injury-data.js";

const startedAt = Date.now();
const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "FANTASYPROS_API_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
const bucket = process.env.ADMIN_BUCKET || "admin";
const snapshotKey = "data/stream/injuries.json";
const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });

async function getJson(key) {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await object.Body.transformToString());
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function putJson(key, value) {
  const body = JSON.stringify(value);
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/json; charset=utf-8", CacheControl: "no-store" }));
  return Buffer.byteLength(body);
}

const previous = await getJson(snapshotKey);
const seasonGuess = Number(previous?.season) || new Date().getUTCFullYear();
let history = await getJson(`data/stream/injury-history/${seasonGuess}.json`);
let result = await buildInjuryData({ previous, historyDocument: history, fantasyProsKey: process.env.FANTASYPROS_API_KEY, updatedBy: process.env.STREAM_REQUESTED_BY || "scheduled" });
if (Number(result.payload.season) !== seasonGuess) {
  history = await getJson(`data/stream/injury-history/${result.payload.season}.json`);
  result = await buildInjuryData({ previous, historyDocument: history, fantasyProsKey: process.env.FANTASYPROS_API_KEY, updatedBy: process.env.STREAM_REQUESTED_BY || "scheduled" });
}
const historyBytes = await putJson(`data/stream/injury-history/${result.payload.season}.json`, result.journal);
const snapshotBytes = await putJson(snapshotKey, result.payload);
await fs.mkdir("auto", { recursive: true });
await fs.writeFile(path.join("auto", `stream_injuries_${result.payload.season}.json`), JSON.stringify(result.payload));
console.log(JSON.stringify({ tool: "injuries", ok: true, ...result.summary, r2: { reads: history ? 2 : 1, writes: 2, bytes: snapshotBytes + historyBytes }, durationMs: Date.now() - startedAt }));
