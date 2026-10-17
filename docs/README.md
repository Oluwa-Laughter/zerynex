# Documentation authoring and publication

This directory includes both **public Zerynex developer guides** and **internal repository notes**. Its contents are not automatically part of the product website.

The public website is driven exclusively by the curated `docs/catalog.json` entries. `scripts/sync-docs.mjs` copies **only the listed `.md` files** to `apps/web/content/docs/`. Unlisted files remain available in the source repository for maintainers and contributors and do not get a public `/docs/<slug>` route.

Public docs serve developers using the shipped toolkit. The canonical navigation follows:

1. **Start here** — a first successful example, installation, safety and downloads.
2. **Core concepts** — the PCZT disclosure model, policy configuration and handoffs.
3. **SDKs & APIs** — Rust, CLI, TypeScript/browser, Python, Go, and validated interfaces.
4. **Automation** — GitHub Actions and restricted MCP/agent integration.
5. **Reference** — machine-readable report contracts and infrastructure checks.

Internal-only material includes product and responsive design records, deployment runbooks, maintenance procedures, speculative ecosystem research and backlog/roadmaps. These belong in the repository and **must not** be included in `catalog.json`. When such information becomes a shipped developer capability, write a focused end-user guide with commands, source-backed behavior, limitations and runnable tests; don't simply link an internal README into the website.

## Checklist for publishing

- Explain the user problem and show a real, nonspendable reproducible example.
- Link to canonical public guides using `slug.md` relative Markdown links; do not link an unpublished internal note as a website page.
- Describe version requirements and whether registry packages are truly published.
- Clearly distinguish shipped, partial and preview integrations from unverified research.
- Keep wallet credentials, private PCZTs and transaction values out of public fixtures and CI.
- Add the new page to the appropriate `catalog.json` group, then run:

```bash
node scripts/sync-docs.mjs
node scripts/validate-docs.mjs
node scripts/test-public-docs.mjs
```

Website tests assert that internal-only source notes never appear in navigation, search results or generated routes. The local source files are retained rather than deleted.
