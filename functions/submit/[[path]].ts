import {
  SITE_ORIGIN,
  loadSpaShell,
  renderSeoHtml,
  responseFromShell,
  type SeoEnv,
} from "../../functions-shared/seo";

export const onRequestGet: PagesFunction<SeoEnv> = async (context) => {
  const shell = await loadSpaShell(context.env, context.request);
  if (!shell.ok) return shell;

  const url = new URL(context.request.url);
  const title = url.pathname.endsWith("/artifact-review")
    ? "Review artifacts · PaperTrust"
    : "Submit a reproduction · PaperTrust";
  const description = url.pathname.endsWith("/artifact-review")
    ? "Submit an artifact availability review to the PaperTrust public evidence ledger."
    : "Submit a reproduction result to the PaperTrust public evidence ledger.";

  const html = await shell.text();
  const rendered = renderSeoHtml(
    html,
    {
      title,
      description,
      canonical: `${SITE_ORIGIN}${url.pathname}`,
      robots: "noindex,follow",
    },
    "",
  );
  return responseFromShell(shell, rendered);
};
