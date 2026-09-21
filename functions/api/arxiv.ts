interface Env {}

const MODERN = /^\d{4}\.\d{4,5}$/;
const LEGACY = /^[a-z-]+\/\d{7}$/i;

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";

  if (!MODERN.test(id) && !LEGACY.test(id)) {
    return new Response("Invalid arXiv ID", { status: 400 });
  }

  const upstream = await fetch(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    {
      headers: { "User-Agent": "PaperTrust/0.1 (https://papertrust.org)" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit,
  );

  if (!upstream.ok) return new Response("arXiv unavailable", { status: 502 });

  const body = await upstream.text();
  if (!body.includes("<entry>")) return new Response("Paper not found", { status: 404 });

  return new Response(body, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=900, s-maxage=3600",
    },
  });
};
