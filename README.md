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
