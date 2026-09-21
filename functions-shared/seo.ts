import YAML from "yaml";

export const SITE_ORIGIN = "https://papertrust.org";
export const DATA_REPO = "papertrust/papertrust-data";

const MODERN = /^\d{4}\.\d{4,5}$/;
const LEGACY = /^[a-z-]+\/\d{7}$/i;

export interface SeoEnv {
  ASSETS: {
    fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
  };
}

export interface ArxivMetadata {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  absUrl: string;
}

export interface LedgerRecord {
  type: string;
  paper_version?: string;
  result?: string;
  tags?: string[];
  summary: string;
  evidence?: string[];
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  ogType?: string;
}

export function isValidArxivId(id: string): boolean {
  return MODERN.test(id) || LEGACY.test(id);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

function decodeXml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name] ?? entity);
}

function cleanXmlText(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function firstTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanXmlText(match[1]) : "";
}

export async function fetchArxivMetadata(id: string): Promise<ArxivMetadata | null> {
  const upstream = await fetch(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    {
      headers: { "User-Agent": "PaperTrust/0.1 (https://papertrust.org)" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit,
  );

  if (upstream.status === 404) return null;
  if (!upstream.ok) throw new Error(`arXiv request failed: ${upstream.status}`);

  const xml = await upstream.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) return null;

  const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi))
    .map((match) => cleanXmlText(match[1]))
    .filter(Boolean);
  const categories = Array.from(entry.matchAll(/<category\b[^>]*\bterm=["']([^"']+)["'][^>]*\/?\s*>/gi))
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
  const alternate = entry.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i)
    ?? entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["'][^>]*\/?\s*>/i);

  return {
    id,
    title: firstTag(entry, "title"),
    summary: firstTag(entry, "summary"),
    authors,
    published: firstTag(entry, "published"),
    updated: firstTag(entry, "updated"),
    categories,
    absUrl: alternate ? decodeXml(alternate[1]) : `https://arxiv.org/abs/${id}`,
  };
}

export async function fetchLedgerRecords(id: string): Promise<LedgerRecord[]> {
  const upstream = await fetch(
    `https://raw.githubusercontent.com/${DATA_REPO}/main/papers/${id}.yaml`,
    { cf: { cacheTtl: 120, cacheEverything: true } } as RequestInit,
  );
  if (upstream.status === 404) return [];
  if (!upstream.ok) throw new Error(`Ledger request failed: ${upstream.status}`);

  const parsed = YAML.parse(await upstream.text()) as { records?: unknown };
  if (!Array.isArray(parsed?.records)) return [];

  return parsed.records.flatMap((record): LedgerRecord[] => {
    if (!record || typeof record !== "object") return [];
    const candidate = record as Record<string, unknown>;
    if (typeof candidate.type !== "string" || typeof candidate.summary !== "string") return [];

    return [{
      type: candidate.type,
      paper_version: typeof candidate.paper_version === "string" ? candidate.paper_version : undefined,
      result: typeof candidate.result === "string" ? candidate.result : undefined,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((value): value is string => typeof value === "string")
        : undefined,
      summary: candidate.summary,
      evidence: Array.isArray(candidate.evidence)
        ? candidate.evidence.filter((value): value is string => typeof value === "string")
        : undefined,
    }];
  });
}

export async function loadSpaShell(env: SeoEnv, request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return env.ASSETS.fetch(new Request(url, request));
}

function upsertMeta(html: string, selector: RegExp, replacement: string): string {
  if (selector.test(html)) return html.replace(selector, replacement);
  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

export function renderSeoHtml(
  shell: string,
  meta: PageMeta,
  fallbackHtml: string,
  jsonLd?: Record<string, unknown>,
): { html: string; nonce?: string } {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.canonical);
  const ogType = escapeHtml(meta.ogType ?? "website");
  const robots = escapeHtml(meta.robots ?? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  const image = `${SITE_ORIGIN}/brand/logo-512.png`;

  let html = shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<meta\s+property=["']og:title["'][^>]*>/i,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta\s+property=["']og:description["'][^>]*>/i,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta\s+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${image}" />`,
    );

  html = upsertMeta(
    html,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+name=["']robots["'][^>]*>/i,
    `<meta name="robots" content="${robots}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="${ogType}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+name=["']twitter:card["'][^>]*>/i,
    '<meta name="twitter:card" content="summary" />',
  );
  html = upsertMeta(
    html,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${title}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${description}" />`,
  );
  html = upsertMeta(
    html,
    /<meta\s+name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${image}" />`,
  );

  html = html.replace(
    /<!--seo-fallback-start-->[\s\S]*?<!--seo-fallback-end-->/i,
    `<!--seo-fallback-start-->${fallbackHtml}<!--seo-fallback-end-->`,
  );

  if (!jsonLd) return { html };

  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const nonce = btoa(String.fromCharCode(...bytes));
  const serialized = JSON.stringify(jsonLd).replaceAll("<", "\\u003c");
  html = html.replace(
    "</head>",
    `    <script type="application/ld+json" nonce="${nonce}">${serialized}</script>\n  </head>`,
  );
  return { html, nonce };
}

export function responseFromShell(
  asset: Response,
  rendered: { html: string; nonce?: string },
  status = 200,
): Response {
  const headers = new Headers(asset.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=300, s-maxage=900");
  headers.delete("content-length");
  headers.delete("etag");

  if (rendered.nonce) {
    const current = headers.get("content-security-policy");
    if (current) {
      headers.set(
        "content-security-policy",
        current.replace("script-src 'self'", `script-src 'self' 'nonce-${rendered.nonce}'`),
      );
    }
  }

  return new Response(rendered.html, { status, headers });
}
