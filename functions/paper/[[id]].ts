import {
  SITE_ORIGIN,
  escapeHtml,
  fetchArxivMetadata,
  fetchLedgerRecords,
  isValidArxivId,
  loadSpaShell,
  renderSeoHtml,
  responseFromShell,
  type ArxivMetadata,
  type LedgerRecord,
  type SeoEnv,
} from "../../functions-shared/seo";

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join("/") : (value ?? "");
}

function recordLabel(record: LedgerRecord): string {
  return record.type.replaceAll("_", " ");
}

function recordHtml(record: LedgerRecord): string {
  const version = record.paper_version
    ? ` <span class="paper-version">${escapeHtml(record.paper_version)}</span>`
    : "";
  const result = record.result
    ? `<p><strong>Result:</strong> ${escapeHtml(record.result.replaceAll("_", " "))}</p>`
    : "";
  const tags = record.tags?.length
    ? `<p><strong>Tags:</strong> ${record.tags.map((tag) => escapeHtml(tag.replaceAll("_", " "))).join(", ")}</p>`
    : "";
  const evidence = record.evidence?.length
    ? `<p><strong>Evidence:</strong> ${record.evidence.map((doi) => escapeHtml(doi)).join(", ")}</p>`
    : "";

  return `<article class="record-card">
    <div class="record-head"><div><span class="record-type">${escapeHtml(recordLabel(record))}</span>${version}</div></div>
    ${result}
    <p>${escapeHtml(record.summary)}</p>
    ${tags}
    ${evidence}
  </article>`;
}

function paperFallback(
  id: string,
  paper: ArxivMetadata,
  records: LedgerRecord[],
): string {
  const authors = paper.authors.map(escapeHtml).join(" · ");
  const categories = paper.categories.slice(0, 3)
    .map((category) => `<span>${escapeHtml(category)}</span>`)
    .join("");
  const ledger = records.length
    ? records.map(recordHtml).join("")
    : `<div class="empty-state"><h3>No PaperTrust record yet</h3><p>This paper is not indexed in the ledger until a reviewed community record is merged.</p></div>`;

  return `<div class="site-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="nav">
      <a class="brand" href="/"><img class="brand-logo" src="/brand/logo-mark.svg" alt="" /><span>PaperTrust</span></a>
      <nav class="nav-links" aria-label="Main navigation">
        <a href="/about">About</a>
        <a href="https://github.com/papertrust/papertrust-data">Data</a>
        <a href="https://github.com/papertrust/papertrust">Source</a>
      </nav>
    </header>
    <main id="main-content">
      <section class="page paper-page" itemscope itemtype="https://schema.org/ScholarlyArticle">
        <a class="back-link" href="/">← Find another paper</a>
        <div class="paper-kicker"><span itemprop="identifier">arXiv:${escapeHtml(id)}</span>${categories}</div>
        <h1 class="paper-title" itemprop="headline">${escapeHtml(paper.title)}</h1>
        <p class="authors" itemprop="author">${authors}</p>
        <p><a href="${escapeHtml(paper.absUrl)}" itemprop="sameAs">View on arXiv</a></p>
        <div class="paper-grid">
          <div>
            <section class="section-block">
              <div class="section-title"><div><span class="section-label">PaperTrust ledger</span><h2>Reviewed records</h2></div><span class="count">${records.length}</span></div>
              <div class="records">${ledger}</div>
            </section>
          </div>
          <aside>
            <div class="side-card"><span class="section-label">Abstract</span><p class="abstract" itemprop="abstract">${escapeHtml(paper.summary)}</p></div>
          </aside>
        </div>
      </section>
    </main>
  </div>`;
}

export const onRequestGet: PagesFunction<SeoEnv> = async (context) => {
  const rawId = normalizeParam(context.params.id as string | string[] | undefined);
  let id: string;
  try {
    id = decodeURIComponent(rawId).trim();
  } catch {
    id = "";
  }

  if (!isValidArxivId(id)) {
    return new Response("Paper not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
    });
  }

  const shell = await loadSpaShell(context.env, context.request);
  if (!shell.ok) return shell;

  let paper;
  try {
    paper = await fetchArxivMetadata(id);
  } catch {
    const html = await shell.text();
    const canonicalPath = id.split("/").map(encodeURIComponent).join("/");
    const rendered = renderSeoHtml(
      html,
      {
        title: `arXiv:${id} · PaperTrust`,
        description: `PaperTrust evidence page for arXiv:${id}. Paper metadata is temporarily unavailable.`,
        canonical: `${SITE_ORIGIN}/paper/${canonicalPath}`,
        robots: "noindex,follow",
      },
      `<main class="page narrow prose"><h1>Opening arXiv:${escapeHtml(id)}</h1><p>Paper metadata is temporarily unavailable. The interactive page will retry automatically.</p></main>`,
    );
    return responseFromShell(shell, rendered);
  }
  if (!paper) {
    const html = await shell.text();
    const rendered = renderSeoHtml(
      html,
      {
        title: "Paper not found · PaperTrust",
        description: "This arXiv identifier does not resolve to a paper.",
        canonical: `${SITE_ORIGIN}/paper/${id.split("/").map(encodeURIComponent).join("/")}`,
        robots: "noindex,follow",
      },
      `<main class="page narrow prose"><h1>Paper not found</h1><p>This arXiv identifier does not resolve to a paper.</p><a href="/">Back to PaperTrust</a></main>`,
    );
    return responseFromShell(shell, rendered, 404);
  }

  let records: LedgerRecord[] = [];
  try {
    records = await fetchLedgerRecords(id);
  } catch {
    records = [];
  }

  const canonicalPath = id.split("/").map(encodeURIComponent).join("/");
  const canonical = `${SITE_ORIGIN}/paper/${canonicalPath}`;
  const recordPhrase = records.length === 1 ? "1 reviewed PaperTrust record" : `${records.length} reviewed PaperTrust records`;
  const description = `${paper.title} — arXiv:${id}. ${recordPhrase} with reproducibility and artifact evidence.`.slice(0, 300);
  const title = `${paper.title} · PaperTrust`;
  const html = await shell.text();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: paper.title,
    abstract: paper.summary,
    author: paper.authors.map((name) => ({ "@type": "Person", name })),
    datePublished: paper.published || undefined,
    dateModified: paper.updated || undefined,
    identifier: [`arXiv:${id}`, paper.absUrl],
    url: canonical,
    sameAs: paper.absUrl,
    keywords: paper.categories,
    mainEntityOfPage: canonical,
  };

  const rendered = renderSeoHtml(
    html,
    {
      title,
      description,
      canonical,
      robots: records.length
        ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
        : "noindex,follow",
      ogType: "article",
    },
    paperFallback(id, paper, records),
    jsonLd,
  );
  return responseFromShell(shell, rendered);
};
