// functions/api/gauntlet-rebuild.js
// Cloudflare Pages Function – trigger GitHub workflow_dispatch

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = env.GH_WORKFLOW_TOKEN;
  if (!token) {
    return new Response("GitHub token not configured", { status: 500 });
  }

  const owner = "spickworth1991";
  const repo = "ballsville"; // your repo
  const workflowFile = "build-gauntlet.yml"; // your workflow filename

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        // 👇 THIS is what GitHub was complaining about
        "User-Agent": "ballsville-gauntlet-admin", 
        // optional but nice:
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main", // or whatever your default branch is
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
