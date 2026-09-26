const APPROVER = "contact.stickypicky@gmail.com";

function cleanHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

export async function sendAdminApprovalEmail(env, request, account, token) {
  const origin = String(env.ADMIN_PUBLIC_ORIGIN || env.STREAM_PUBLIC_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
  const reviewUrl = `${origin}/admin/access-review?token=${encodeURIComponent(token)}&username=${encodeURIComponent(account.username)}`;
  if (String(env.ADMIN_APPROVAL_DEV_MODE || "").toLowerCase() === "true") return { reviewUrl };

  const apiToken = env.ADMIN_EMAIL_API_TOKEN || env.STREAM_EMAIL_API_TOKEN;
  if (!env.CLOUDFLARE_ACCOUNT_ID || !apiToken) throw new Error("Cloudflare Email API credentials are not configured.");
  const from = cleanHeader(
    env.ADMIN_APPROVAL_FROM_EMAIL ||
    env.STREAM_APPROVAL_FROM_EMAIL ||
    "stream@theballsvillegame.com",
  );
  const subject = `Ballsville admin access request: ${cleanHeader(account.username)}`;
  const text = [
    `Username: ${account.username}`,
    `Contact email: ${account.email || "Not provided"}`,
    "",
    "Open this private link to review, approve, or reject the admin request:",
    reviewUrl,
    "",
    "The link expires in 48 hours. Opening it does not automatically approve the account.",
  ].join("\r\n");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/email/sending/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ to: APPROVER, from, subject, text }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.errors?.[0]?.message || `Cloudflare Email API returned ${response.status}.`);
  return { reviewUrl: null };
}
