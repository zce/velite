# 05: Derive MDX Source Analysis and emit MDX code

Status: ready-for-agent
Execution: completed

**What to build:** A consumer derives MDX code, excerpts, and reading metadata from one explicit MDX definition using dialect-correct syntax and one ordinary processing continuation, without runtime evaluation.

**Blocked by:** 04 — Emit Markdown HTML from the same owned execution.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Expose working MDX definition/code/excerpt/metadata factories as ordinary Zod schemas through the package, preserving input/output inference and generated collection types.
- [x] Add a separate real MDX dialect adapter while reusing record ownership, identity/input lookup, fixed-stage coordination, semantic delivery, and transaction/lifecycle contracts. Do not force Markdown and MDX into one parser or AST.
- [x] Assemble one MDX processor before Parse with supported configuration/defaults/precedence/plugin order. Local dependency typing corrections match real parse/run/stringify behavior and do not leak unstable AST types publicly.
- [x] Source Analysis includes ordinary/static-inline-code text and statically known nested JSX text children; exclude expressions, ESM, names, attributes, comments, and values requiring evaluation. Reuse the exact complete-text/excerpt/metadata oracle rather than count raw MDX syntax.
- [x] Source-only MDX performs initialization and Parse, not returned transformers, recma processing, serialization, or minification. Attacher behavior remains ordinary; no promise of zero plugin I/O is inferred.
- [x] Complete Transform includes normal remark/rehype conversion and the full MDX recma/code-AST chain. Emit performs serialization and configured minification; supported program/function-body and development options remain functional.
- [x] Do not execute generated JavaScript, imports, expressions, or components while deriving any result. Source fixtures can prove excluded code remains unevaluated.
- [x] Code and concurrent/late source selections share one definition/input execution without replay. Separate definitions, different inputs, records, and Markdown definitions remain independent.
- [x] Follow legal tree/file replacements and ordinary compiler/file/message behavior. Opaque plugin-owned state is preserved by normal ownership, not cloned or classified for eligibility.
- [x] Parse/Transform/Emit failures follow fixed dependencies, retain rejection without retry, preserve lower-stage Source Analysis, and respect normal Zod recovery while keeping invariant faults thrown.
- [x] Reuse active-stage journals/captured-capability routing and one-time eligibility for all MDX phases, including async recma work and Emit/minification failure. The record gate still decides commitment eligibility.
- [x] Configured linked-file handling, canonical source ownership, detached metadata delivery, basic terminal close, and bounded continuation/snapshot retention match the established semantic contracts.
- [x] Publish only working methods for this increment and keep the approved migration baseline green. MDX navigation is delivered by Ticket 07 rather than an unimplemented stub or source-only fallback.

## Scope and verification

Use actual MDX and minifier dependencies and packaged code-plus-source fixtures, with independent static-text/value oracles and ordinary plugin observations. Supplement with existing controlled record seams for failures/effects; generated runtime execution is not necessary to establish this contract. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — implementation and two-axis acceptance

- Criteria 1–3, 5–6, 13: real `execution/mdx.ts` adapter, package `content.mdx()` code/source factories, consumer input/output and dialect-negative checks. Local-before-global remark/rehype/recma order and local program/development/minify precedence are observed. Full MDX run and real Terser serialization/minification run only for generated code; no navigation placeholder exposed.
- Criteria 4, 7–9: independent static source `Original Hello 茶 inline` / 3.56 fixture excludes imports, throwing expressions, attributes, comments and blocks without evaluation; source-only skips transformer/recma/compiler. Shared code plus late source observes exactly one Parse/run/recma/compiler. Callback replacement file/Map data reaches real recma/compiler with canonical diagnostic provenance.
- Criteria 10–12: retained async recma and actual malformed-JavaScript minifier failures recover through native catch without retry; successful Parse/Transform assets publish, failed-stage declarations do not. Linked asset flow and detached source metadata reuse the record module and terminal gates.
- RED absent `mdx` → GREEN five packaged fixtures; `pnpm build` → `pnpm test`: 409 passed, 0 failures/skips (session `05-verification.md`).
- Separate lead Standards review passed for explicit DI, lazy external dependencies, local dependency typing and no opaque-state copying. Separate Spec review passed for complete-run/source distinction, configuration/transaction/consumer coverage; 01–04 regressions remain green. Subagent quota fallback remains in effect.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–9: `src/core/content/execution/mdx.ts:23`, `:30` and `:71` use the actual MDX processor/minifier behind the shared owner. `test/integration/content-mdx.tests.ts:8`, `:43`, `:59` and `:106` assert static non-evaluation, source-only phase boundaries, local/global plugin order, shared late selections and legal replacement/compiler continuity; `test/fixtures/ts-consumer/consumer.ts:80` covers inferred result types.
- Criteria 10–12: `test/integration/content-mdx.tests.ts:79` observes retained async recma and real Terser failure with only successful lower-stage assets. `src/core/content/execution/record.ts:61`, `:119`, `:194` and `:226` provide active journals, detached delivery and terminal cleanup for both adapters. Criteria 13 is the recorded 409-test incremental scope; working MDX navigation arrived in Ticket 07, not a stub in this slice.

### 2026-10-05 — shared controlled-asset terminal regression repaired

- Independent STD-02 is repaired once in shared `record.ts:117`, before managed asset demand, not in a duplicate MDX adapter or public runner protocol. Real SchemaRunner/Zod sibling and deterministic pending-transform/read barriers in `test/core/content-terminal-assets.tests.ts:277`, `:300` prove MDX post-close demand/read/probe/Emit/promotion cannot start, original errors remain, and already-started I/O may settle without a declaration. Native Promise observation and ordinary `.catch()` failure identity remain intact.
- The original source-only/real recma/program/development/minification/replacement/private-state/source/recovery/assets/types controls remain green; new MDX static-descendant tests keep source semantics distinct from complete-title certainty without code execution. Lead strict affected 213/213 and complete new Node26/minimum22 build→test/runtime suites 588/588 each; independent Standards and Spec PASS. Session `20261005-0050-semantic-acceptance-repairs/` records commands and 13-criterion mapping; related 07/09 records specify genuine defect, RED→GREEN and unchanged external-I/O limits. No contract/Status/ADR change.
