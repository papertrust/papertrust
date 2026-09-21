import {
  SITE_ORIGIN,
  loadSpaShell,
  renderSeoHtml,
  responseFromShell,
  type SeoEnv,
} from "../functions-shared/seo";

export const onRequestGet: PagesFunction<SeoEnv> = async (context) => {
  const shell = await loadSpaShell(context.env, context.request);
  if (!shell.ok) return shell;

  const html = await shell.text();
  const fallback = `<div class="site-shell">
    <header class="nav"><a class="brand" href="/"><img class="brand-logo" src="/brand/logo-mark.svg" alt="" /><span>PaperTrust</span></a></header>
    <main id="main-content">
      <section class="page narrow prose">
        <div class="eyebrow">The PaperTrust approach</div>
        <h1>Evidence, not verdicts.</h1>
        <p>PaperTrust is a public record of reviewed reproduction attempts and artifact findings. It does not assign a trust score, decide whether a paper is true, or infer misconduct from missing artifacts.</p>
        <h2>What is canonical?</h2>
        <p>GitHub issues carry submissions and discussion. Pull requests carry reviewed changes. Only data merged into the public papertrust-data repository is canonical.</p>
        <h2>What is stored?</h2>
        <p>Only PaperTrust-specific records: record type, the exact paper version, structured result and tags, a Markdown summary, and optional persistent evidence references. arXiv metadata is resolved on demand.</p>
      </section>
    </main>
  </div>`;

  const rendered = renderSeoHtml(
    html,
    {
      title: "About · PaperTrust",
      description: "How PaperTrust records reviewed reproduction attempts, artifact findings, and persistent evidence without assigning trust scores.",
      canonical: `${SITE_ORIGIN}/about`,
    },
    fallback,
  );
  return responseFromShell(shell, rendered);
};
