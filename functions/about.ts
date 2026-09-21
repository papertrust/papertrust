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
        <div class="eyebrow">Why PaperTrust exists</div>
        <h1>A longer memory for scientific evidence.</h1>
        <p>Science has a long memory for citations and a surprisingly short one for details. A paper can travel quickly through a field while the evidence around it is scattered across repositories, issue threads, lab notes, benchmark scripts, revised checkpoints, and conversations that are difficult to find a year later. Someone returning to the work often has to reconstruct that history from fragments.</p>
        <p>Those fragments matter. Reproducibility is rarely a single yes-or-no event: a result may depend on an exact paper version, an undocumented flag, a particular evaluation script, a dataset revision, or an artifact that appeared months after publication. Failed attempts can be informative. So can partial successes, corrections, and careful reports that simply establish what was publicly available at a given moment.</p>

        <h2>The gap we want to close</h2>
        <p>The formal literature is very good at preserving claims, arguments, and credit. The living technical history around a paper has fewer durable places to go. Independent reproduction work is often buried in personal repositories or short-lived discussion threads; negative results are especially easy to lose. The next person then pays the same investigative cost again.</p>
        <p>PaperTrust gives that work a small, durable home. Each record is scoped to a specific paper version and says what was checked, what happened, and where the supporting evidence can be inspected. The canonical ledger is plain data in Git. Submissions arrive through public issues, proposed changes are reviewed as pull requests, and the merged history remains available for anyone to audit.</p>

        <h2>Evidence should keep its context</h2>
        <p>A single score would compress away much of what makes reproducibility evidence useful. Conditions change, artifacts improve, software rots, and two careful groups can reach different outcomes for understandable reasons. PaperTrust keeps the underlying observations visible so readers can weigh them in context. Records can coexist, be challenged, and be followed by later evidence without erasing the path that led there.</p>
        <p>That is also why the ledger stores relatively little: record type, exact paper version, structured result and tags, a written summary, and optional persistent evidence references. arXiv remains the source for paper metadata. Git remains the source for authorship, review history, and change history. Keeping those boundaries clear makes the record easier to inspect and harder to quietly rewrite.</p>

        <h2>The academic world we hope for</h2>
        <p>We would like reproducibility work to feel like a first-class scholarly contribution. We would like corrections to be ordinary, negative results to remain discoverable, and released artifacts to stay connected to the claims they support. A researcher encountering an unfamiliar paper should be able to see more than its citation count: what others tried, which version they used, what evidence survived, and where uncertainty still remains.</p>
        <p>Scrutiny can be a form of care for the scientific record. Done well, it helps good work age gracefully and gives future work firmer ground. Our hope is modest: a literature with a longer memory, a shorter distance between claim and evidence, and a little less knowledge lost between publication and replication. PaperTrust is one small piece of infrastructure toward that world.</p>
      </section>
    </main>
  </div>`;

  const rendered = renderSeoHtml(
    html,
    {
      title: "About · PaperTrust",
      description: "Why PaperTrust preserves reviewed reproduction evidence, artifact findings, and the technical history around scientific claims.",
      canonical: `${SITE_ORIGIN}/about`,
    },
    fallback,
  );
  return responseFromShell(shell, rendered);
};
