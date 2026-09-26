const APPROVER = "contact.stickypicky@gmail.com";

function cleanHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

export async function sendStreamApprovalEmail(env, request, account, token) {
  const origin = String(env.STREAM_PUBLIC_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
  const reviewUrl = `${origin}/stream/access-review?token=${encodeURIComponent(token)}&username=${encodeURIComponent(account.username)}`;

  if (String(env.STREAM_APPROVAL_DEV_MODE || "").toLowerCase() === "true") {
    return { reviewUrl };
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.STREAM_EMAIL_API_TOKEN) {
    throw new Error("Cloudflare Email API credentials are not configured.");
  }

  const from = cleanHeader(env.STREAM_APPROVAL_FROM_EMAIL || "stream@theballsvillegame.com");
  const subject = `Stream Room access request: ${cleanHeader(account.username)}`;
  const details = [
    `Username: ${account.username}`,
    `Contact email: ${account.email || "Not provided"}`,
    "",
    "Open this private link to review, approve, or reject the request:",
    reviewUrl,
    "",
    "The link expires in 48 hours. Opening it does not automatically approve the account.",
  ].join("\r\n");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/email/sending/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.STREAM_EMAIL_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ to: APPROVER, from, subject, text: details }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.errors?.[0]?.message || `Cloudflare Email API returned ${response.status}.`);
  }
  return { reviewUrl: null };
}
