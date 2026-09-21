import { DATA_REPO, SITE_ORIGIN, escapeXml } from "../functions-shared/seo";

interface GitTreeEntry {
  path?: string;
  type?: string;
}

interface GitTreeResponse {
  tree?: GitTreeEntry[];
}

export const onRequestGet: PagesFunction = async () => {
  const upstream = await fetch(
    `https://api.github.com/repos/${DATA_REPO}/git/trees/main?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "PaperTrust/0.1 (https://papertrust.org)",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit,
  );

  let paperIds: string[] = [];
  if (upstream.ok) {
    const payload = await upstream.json() as GitTreeResponse;
    paperIds = (payload.tree ?? [])
      .flatMap((entry) => {
        if (entry.type !== "blob" || !entry.path?.startsWith("papers/") || !entry.path.endsWith(".yaml")) {
          return [];
        }
        return [entry.path.slice("papers/".length, -".yaml".length)];
      })
      .sort();
  }

  const urls = [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/about`,
    ...paperIds.map((id) => `${SITE_ORIGIN}/paper/${id.split("/").map(encodeURIComponent).join("/")}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
};
