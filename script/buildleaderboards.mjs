// Build + upload Ballsville leaderboards JSONs to R2.
//
// Produces files in ./auto/ (via scripts/leaderboards/auto-gen.js), then uploads them to
// R2 under the prefix: data/leaderboards/
//
// Required env vars (same pattern as buildgauntlet.mjs):
// - R2_ACCOUNT_ID
// - R2_ACCESS_KEY_ID
// - R2_SECRET_ACCESS_KEY
// - R2_BUCKET_LEADERBOARDS  (bucket name)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function must(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const accountId = must("R2_ACCOUNT_ID");
const accessKeyId = must("R2_ACCESS_KEY_ID");
const secretAccessKey = must("R2_SECRET_ACCESS_KEY");
const bucket = must("R2_BUCKET_LEADERBOARDS");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function putFile(localPath, key) {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(localPath),
    })
  );
}

async function main() {
  // 1) Generate JSONs
  const autoDir = path.join(ROOT, "auto");
  if (fs.existsSync(autoDir)) fs.rmSync(autoDir, { recursive: true, force: true });

  console.log("\n=== Generating leaderboards JSONs ===\n");
  run("node", [path.join(ROOT, "scripts/leaderboards/auto-gen.js")], { cwd: ROOT });

  if (!fs.existsSync(autoDir)) {
    throw new Error("auto/ folder was not created by auto-gen.js");
  }

  // 2) Upload to R2 under data/leaderboards/
  console.log("\n=== Uploading to R2 ===\n");
  const files = listFilesRecursive(autoDir).filter((f) => f.endsWith(".json"));
  files.sort();

  for (const f of files) {
    const rel = path.relative(autoDir, f).split(path.sep).join("/");
    const key = `data/leaderboards/${rel}`;
    console.log(`PUT r2://${bucket}/${key}`);
    await putFile(f, key);
  }

  console.log("\n✅ Leaderboards uploaded.");
}

main().catch((err) => {
  console.error("\n❌ buildleaderboards failed:", err);
  process.exit(1);
});
