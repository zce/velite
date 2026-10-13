# 09 — Bench pass, knowledge promotion, final report

Status: resolved

## Bench (new baseline)

`pnpm bench:large` — fixture 20000 docs + 20000 assets:

- full build: 50.81s, rss 2125MB, heap 368MB
- no-op rebuild: 1.47s, rss 2215MB, heap 555MB
- single-file incremental rebuild: 204ms, rss 2294MB, heap 669MB

No pre-round-2 baseline exists on this machine for a strict comparison, but the numbers validate the structural claims: the no-op rebuild (1.5s over 20k docs) proves memoization survives the demand-based asset flow, and the 204ms single-file incremental proves the derivation graph still invalidates one file's closure only.

## Knowledge promotion

- `.agents/knowledge/schema-context.md` updated during ticket 06 (single-surface `collectEffect`).
- The demand-based asset flow design is documented where it lives: the `resolveAssets` / `copyAssets` / asset-derivation JSDoc blocks in `driver.ts` / `pipeline/asset.ts`. No knowledge file describes effect shapes in stale terms (verified by grep).
- Long-function scan: zero functions >80 lines in `driver.ts` / `record.ts`.

## Report

`report.md` written in this folder. Full verification matrix green (build / tsc / 629 tests / docs build).
