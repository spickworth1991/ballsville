import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getADPGroupData } from "../lib/adpBuild.js";

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const bucket = process.env.ADMIN_BUCKET || "admin";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const text = (value) => (typeof value === "string" ? value : value == null ? "" : String(value));
const slug = (value) =>
  text(value).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

async function readJson(key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await response.Body.transformToString());
}

async function writeJson(key, value) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(value, null, 2),
    ContentType: "application/json; charset=utf-8",
  }));
}

function selectionKey(entry) {
  const leagueId = text(entry?.leagueId).trim();
  const draftId = text(entry?.draftId).trim();
  return leagueId && draftId ? `${leagueId}::${draftId}` : leagueId;
}

function selectedKeys(data) {
  const explicit = Array.isArray(data?.selectedKeys)
    ? data.selectedKeys.map(text).map((v) => v.trim()).filter(Boolean)
    : [];
  return explicit.length
    ? explicit
    : (Array.isArray(data?.leagues) ? data.leagues : []).map(selectionKey).filter(Boolean);
}

function existingLeagueMeta(data) {
  return new Map((Array.isArray(data?.leagues) ? data.leagues : []).map((entry) => [
    text(entry?.selectionKey).trim() || selectionKey(entry),
    {
      leagueName: text(entry?.leagueName || entry?.name || entry?.leagueId).trim(),
      draftName: text(entry?.draftName || entry?.name || entry?.leagueName || entry?.leagueId).trim(),
      isRookie: !!entry?.isRookie,
    },
  ]));
}

const listed = await s3.send(new ListObjectsV2Command({
  Bucket: bucket,
  Prefix: "data/draft-compare/modes_",
}));
const modeFiles = (listed.Contents || [])
  .map((item) => item.Key)
  .filter((key) => /^data\/draft-compare\/modes_\d{4}\.json$/.test(key));

let updated = 0;
let skipped = 0;
let failed = 0;

for (const modesKey of modeFiles) {
  const season = modesKey.match(/modes_(\d{4})\.json$/)?.[1];
  const modesPayload = await readJson(modesKey);
  const modes = Array.isArray(modesPayload?.rows) ? modesPayload.rows : Array.isArray(modesPayload) ? modesPayload : [];
  let seasonUpdated = 0;

  for (const mode of modes.filter((row) => row?.autoUpdate === true)) {
    const modeSlug = slug(mode?.modeSlug || mode?.slug || mode?.title);
    const draftKey = `data/draft-compare/drafts_${season}_${modeSlug}.json`;
    try {
      const previous = await readJson(draftKey);
      const keys = selectedKeys(previous);
      if (!keys.length) {
        console.log(`SKIP ${season}/${modeSlug}: no saved connected leagues`);
        skipped += 1;
        continue;
      }

      const group = await getADPGroupData(keys);
      const meta = existingLeagueMeta(previous);
      const leagues = (group?.leagues || []).map((league) => {
        const key = league?.draftId ? `${league.leagueId}::${league.draftId}` : text(league?.leagueId);
        const old = meta.get(key);
        return {
          ...league,
          leagueName: old?.leagueName || league?.name || league?.leagueId,
          draftName: old?.draftName || league?.name || league?.leagueId,
          isRookie: !!old?.isRookie,
          selectionKey: key,
        };
      });
      const now = new Date().toISOString();
      await writeJson(draftKey, {
        ...previous,
        schemaVersion: 2,
        createdAt: now,
        autoUpdatedAt: now,
        modeSlug,
        title: mode?.title || previous?.title || modeSlug,
        order: Number(mode?.order || previous?.order || 0),
        meta: group?.meta || previous?.meta,
        leagues,
        selectedKeys: keys,
      });
      console.log(`UPDATED ${season}/${modeSlug}: ${keys.length} connected league selections`);
      updated += 1;
      seasonUpdated += 1;
    } catch (error) {
      console.error(`FAILED ${season}/${modeSlug}: ${error?.message || error}`);
      failed += 1;
    }
  }

  if (seasonUpdated > 0) {
    const now = new Date().toISOString();
    await writeJson(`data/manifests/draft-compare_${season}.json`, {
      section: "draft-compare", season: Number(season), updatedAt: now, nonce: crypto.randomUUID(),
    });
    await writeJson("data/manifests/draft-compare.json", {
      section: "draft-compare", season: null, updatedAt: now, nonce: crypto.randomUUID(),
    });
  }
}

console.log(`Done: ${updated} updated, ${skipped} skipped, ${failed} failed`);
if (failed) process.exitCode = 1;
