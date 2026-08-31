export async function onRequestGet({ request }) {
  const id = String(new URL(request.url).searchParams.get("id") || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return new Response("Invalid avatar ID.", { status: 400 });
  }

  const upstream = await fetch(
    `https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(id)}`,
  );
  if (!upstream.ok) {
    return new Response("Avatar not found.", { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
