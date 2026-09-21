interface Env {}

const MODERN = /^\d{4}\.\d{4,5}$/;
const LEGACY = /^[a-z-]+\/\d{7}$/i;

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";

  if (!MODERN.test(id) && !LEGACY.test(id)) {
    return new Response("Invalid arXiv ID", { status: 400 });
  }

  const path = `papers/${id}.yaml`;
  const upstream = await fetch(
    `https://raw.githubusercontent.com/papertrust/papertrust-data/main/${path}`,
    { cf: { cacheTtl: 120, cacheEverything: true } } as RequestInit,
  );

  if (upstream.status === 404) {
    return new Response("No PaperTrust record", { status: 404 });
  }
  if (!upstream.ok) return new Response("Ledger unavailable", { status: 502 });

  return new Response(await upstream.text(), {
    headers: {
      "content-type": "text/yaml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=120",
    },
  });
};
