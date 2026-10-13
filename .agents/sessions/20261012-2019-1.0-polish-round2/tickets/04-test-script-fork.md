# 04 — Investigate and unify `test` vs `test:src`

Status: resolved

## Investigation findings

- `test:src` was a refactor-era companion (session archaeology: created during the semantic-content refactor as an "inner-loop, src-only" suite) with a hand-maintained include list.
- **The src-only premise is false today**: the jiti module loader aliases `velite → dist/index.mjs` (config self-reference), so 48 tests across `test/core/` and `test/runtime/` fail without a build even though they import src directly. The old hand list included those same directories — `test:src` was silently broken as a src-only command.
- Also verified: `--test-ignore` does not exist in Node's test runner (unknown flags after positional patterns get reinterpreted as patterns — the source of misleading probe behavior during investigation).
- CI runs `pnpm test` only; no docs referenced `test:src`.

## Outcome

- **Deleted `test:src`** — a broken promise is worse than no command; `pnpm test` (build + everything, ~12s) is the single entry point.
- **Moved the directly-dist-importing suites into `test/dist/`**: `dist-contract.tests.ts`, `bench-content.tests.ts`, `bench-script.tests.ts` (fixed the `../dist/index.mjs` / repo-root URL depths after the move). The directory groups "exercises the built artifact directly" — factual signal, not a runnable boundary.
- Updated `dist-contract.tests.ts` header + root `AGENTS.md` Testing section to document the real dependency story (jiti alias ⇒ no src-only command exists).

Verified: `pnpm test` — 629/629 green.
