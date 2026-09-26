import { onRequestPost as requestAccess } from "../functions/api/admin/auth/request-access.js";
import {
  onRequestGet as readReview,
  onRequestPost as reviewAccess,
} from "../functions/api/admin/auth/review-access.js";
import { onRequestPost as login } from "../functions/api/admin/auth/login.js";
import { onRequestGet as readSession } from "../functions/api/admin/auth/session.js";

const records = new Map();
const bucket = {
  async get(key) {
    const value = records.get(key);
    if (value === undefined) return null;
    return {
      async json() { return JSON.parse(value); },
      async text() { return value; },
    };
  },
  async put(key, value) { records.set(key, String(value)); },
  async delete(key) { records.delete(key); },
};
const env = {
  ADMIN_BUCKET: bucket,
  ADMIN_AUTH_SECRET: "local-admin-auth-test-secret-that-is-not-used-in-production",
  ADMIN_APPROVAL_DEV_MODE: "true",
  ADMIN_PUBLIC_ORIGIN: "http://localhost:8788",
};

function assertResponse(response, status, step) {
  if (response.status !== status) throw new Error(`${step} returned ${response.status}, expected ${status}.`);
}

let response = await requestAccess({
  request: new Request("http://localhost:8788/api/admin/auth/request-access", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "127.0.0.1" },
    body: JSON.stringify({
      username: "admin_test",
      email: "",
      password: "correct-horse-battery",
      confirmPassword: "correct-horse-battery",
    }),
  }),
  env,
});
assertResponse(response, 201, "Account request");
const requestResult = await response.json();

response = await readReview({ request: new Request(requestResult.devReviewUrl), env });
assertResponse(response, 200, "Review lookup");

response = await reviewAccess({
  request: new Request(requestResult.devReviewUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  }),
  env,
});
assertResponse(response, 200, "Approval");

response = await login({
  request: new Request("http://localhost:8788/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin_test", password: "correct-horse-battery" }),
  }),
  env,
});
assertResponse(response, 200, "Login");
const cookie = response.headers.get("set-cookie")?.split(";")[0];
if (!cookie?.startsWith("ballsville_admin_session=")) throw new Error("Login did not issue the separate Admin cookie.");

response = await readSession({
  request: new Request("http://localhost:8788/api/admin/auth/session", { headers: { cookie } }),
  env,
});
assertResponse(response, 200, "Session lookup");

console.log("Admin account request, approval, login, and cookie session passed.");
