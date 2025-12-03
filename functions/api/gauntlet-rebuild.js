// functions/api/gauntlet-rebuild.js
// Cloudflare Pages Function – trigger GitHub workflow_dispatch

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Optional: simple shared secret to avoid randoms hitting it
  const authHeader = request.headers.get("x-gauntlet-admin-key");
  if (env.GAUNTLET_ADMIN_KEY && authHeader !== env.GAUNTLET_ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = env.GH_WORKFLOW_TOKEN;
  if (!token) {
    return new Response("GitHub token not configured", { status: 500 });
  }

  // TODO: set these to your actual GitHub owner & repo
  const owner = "spickworth1991";
  const repo = "ballsville"; // e.g. "ballsville"
  const workflowFile = "build-gauntlet.yml"; // filename from step 1

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main", // or "master" or whatever your default branch is
        // inputs: { ... } // if you later add inputs to the workflow
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("GitHub workflow_dispatch failed:", res.status, text);
      return new Response(
        JSON.stringify({
          ok: false,
          status: res.status,
          error: text,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error calling GitHub:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
