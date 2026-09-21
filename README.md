# PaperTrust

<img src="public/brand/logo-mark.svg" width="84" alt="PaperTrust logo">


PaperTrust is a Git-native public reproducibility ledger for computer-science papers.

The website is deliberately thin:

- arXiv provides paper metadata.
- `papertrust/papertrust-data` is the canonical public ledger.
- persistent third-party repositories host reproduction evidence.
- GitHub issues carry submissions and discussion.
- merged pull requests define accepted records.
- Cloudflare Pages serves the frontend and two small read-only proxy functions.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Deploy `dist/` with Cloudflare Pages. The `functions/` directory is picked up automatically by Pages.

## Production deployment

The existing Cloudflare Pages project uses Direct Upload. It is not connected to
Cloudflare's native Git integration. The **Deploy PaperTrust** GitHub Actions
workflow builds and deploys every push to `main`, including the `functions/`
directory. Other branches do not deploy to production.

Configure these repository **Actions secrets** once:

- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the existing `papertrust` project.
- `CLOUDFLARE_API_TOKEN`: a dedicated API token with **Account → Cloudflare Pages →
  Edit**, restricted to that account.

Keep both values in encrypted secrets; do not commit credentials or account
identifiers. A local Wrangler OAuth login is not a CI credential.

Missing credentials fail the workflow with an explicit setup error. After adding
them, rerun the workflow or choose **Actions → Deploy PaperTrust → Run workflow**
on `main`. Successful runs publish to the existing `papertrust.pages.dev` project
and its configured custom domain.

For a manual deployment using a local Wrangler login:

```bash
npm ci
npm run lint
npm run build
npx wrangler@4.135.0 pages deploy dist --project-name=papertrust --branch=main
```
