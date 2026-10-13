# 03 — Docs batch 2: remaining pages + guardrail

Status: resolved

## Outcome

- **Wrote real content for the four stub pages** (all previously "still being written" placeholders):
  - `docs/guide/how-it-works.md` — full pipeline walkthrough (config/jiti → discovery → load → validate → emit → two-pass assets → prepare → write → watch), matching the current architecture.
  - `docs/other/faq.md` — 13 real Q&As (Contentlayer relation, node version, assets, `.velite` dir, strict mode, incremental, alpha status…).
  - `docs/guide/motivation.md` — content-as-data / type safety / build-time / framework-agnostic / Contentlayer heritage.
  - `docs/guide/typescript.md` — typed config, generated declarations (real `Infer<Collections[...]>` shape), app imports + aliases, `defineSchema`.
- **examples/nextjs.md**: fixed the broken tree glyphs (line 47 used `|` instead of `│`) and the stale fixture date (`1992-02-25-hello-world` → `2024-05-08-hello-world`, verified against the fixture).
- **zh-CN**: kept the page (user-authored translation) and added an explicit "docs are English for now, PRs welcome" warning instead of leaving an undocumented half-state.
- **CI guardrail**: added a `Build docs` step (`pnpm docs:build`) to `.github/workflows/main.yml` — previously docs only built on the main-branch deploy workflow, so PR-time doc breakage was invisible.

Verified: `pnpm docs:build` green with all new pages.
