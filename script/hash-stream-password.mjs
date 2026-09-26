import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run stream:password -- \"your password\"");
  process.exit(1);
}

// Match Cloudflare Workers' production PBKDF2 iteration ceiling.
const iterations = 100_000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const b64url = (value) => Buffer.from(value).toString("base64url");
console.log(JSON.stringify({ salt: b64url(salt), hash: b64url(hash), iterations }, null, 2));
