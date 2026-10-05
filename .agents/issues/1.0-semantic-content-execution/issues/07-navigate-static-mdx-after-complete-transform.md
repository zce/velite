# 07: Navigate statically known MDX headings after complete Transform

Status: ready-for-agent
Execution: completed

**What to build:** MDX Navigation TOC describes statically determined transformed headings and actual generated targets, while dynamic limitations remain explicit and complete processing success is required before navigation is returned.

**Blocked by:**

- 05 — Derive MDX Source Analysis and emit MDX code.
- 06 — Navigate transformed Markdown with actual Heading Anchors.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Expose the working ordinary MDX TOC result schema with detached flat depth/title/id values, correct package/type behavior, and the shared reviewed anchor contract.
- [x] Place controlled assignment/capture at the end of MDX's user content-phase processing while the transformed content tree is available, before JavaScript conversion. Do not attach it after processor construction at an unintended late code phase.
- [x] Include supported intrinsic static JSX heading elements and statically known transformed headings. Reserve IDs from all statically analyzable current content elements, not only eligible headings; preserve legal explicit targets and share the exact reviewed allocation/conflict values with Markdown.
- [x] If a recognized heading's title or target cannot be statically determined, omit it from Navigation TOC without overwriting dynamic attributes. Handle spread/attribute cases according to the concrete static boundary rather than evaluating or guessing them.
- [x] Unknown components are not assumed to be headings. Do not evaluate expressions/components/imports or reverse-analyze arbitrary generated JavaScript to infer navigation.
- [x] Capture provisional navigation before the content-to-code transition but release it only after the complete ordinary run, including recma, succeeds.
- [x] TOC-only runs the full recma/code-AST processing chain and skips serialization/minification. A later code request resumes without replay; code and TOC requests in either order share actual determined targets.
- [x] A late recma rejection after capture prevents successful TOC and code, preserves Source Analysis, drops that failed stage's effects, and is memoized without retry.
- [x] Capability-limitation warnings belong to the record/content execution and occur only when navigation is actually requested. A late TOC request after completed code can report an already-captured limitation; code-only/source-only use receives no irrelevant TOC warning.
- [x] Code-only output still receives controlled static anchors. Normal TOC-only asset/transform work follows stage/record transactions without duplicate declarations.
- [x] Document and test the build-time contract: downstream code-level plugins must preserve determined headings/anchors, and runtime heading components must forward IDs. Arbitrary runtime DOM guarantees remain excluded.
- [x] Verify generated target structure without executing runtime expressions/components, using the actual dependency chain and independently expected heading/anchor values, not source-slug equivalence.

## Scope and verification

Prefer packaged MDX fixtures and real processing plugins, with controlled recma failure/barriers through existing runtime/record seams where necessary. This slice does not add a runtime rendering analyzer, general projection protocol, or speculative public compiler option family. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — implementation and two-axis acceptance

- Criteria 1–5, 10–12: actual MDX content-phase hook is appended to configured rehype plugins before code conversion; intrinsic/static JSX and Markdown headings use the shared two-pass allocator. Unknown-component literal IDs reserve targets, while components are not invented headings. Expression/spread targets and dynamic titles remain unchanged and unevaluated. Packaged generated code is inspected for actual ID structure; runtime ID forwarding/code-plugin preservation limitations are documented in `docs/guide/content-executions.md`.
- Criteria 6–9: TOC-only observes full recma and zero compiler calls, late code resumes once, late recma rejection withholds provisional TOC without retry and retains source. Source/code-only have no capability warnings; repeated late TOC reports four canonical record-owned limitations once, without field/coordinate invention. Existing linked-asset and stage-effect MDX tests regress.
- RED absent MDX `toc` → GREEN 10 actual MDX navigation tests/subtests. `pnpm build` → `pnpm test`: 429 passed, 0 failures/skips; session `07-verification.md`.
- Separate lead Standards review passed (pure static analysis, local AST typing, ordinary continuation, private bounded snapshots). Separate Spec review passed (correct plugin point, complete-run gating, non-evaluation, static limits and target agreement). Subagent quota fallback remains in effect.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–5, 12: `src/core/content/execution/mdx.ts:48` installs capture in the configured rehype list before code conversion; `src/core/content/execution/navigation.ts:65` shares explicit-ID reservations and static heading limits. `test/integration/content-mdx-navigation.tests.ts:6`, `:39` and `:104` assert intrinsic JSX targets, preserved dynamic attributes, unknown-component reservations and actual generated target structure without runtime evaluation.
- Criteria 6–10: `test/integration/content-mdx-navigation.tests.ts:6`, `:39` and `:89` assert full recma/zero TOC-only serialization, late code reuse, requested-only canonical warnings and rejection of provisional navigation after recma failure. Stage eligibility additionally uses `test/integration/content-mdx.tests.ts:79`; detached TOC delivery uses `test/integration/content-composition.tests.ts:28`.
- Criterion 11: `docs/guide/content-executions.md:74` documents complete Transform and the downstream code-plugin/runtime ID-forwarding boundary; the generated-code assertions above prove the build-time side, not arbitrary runtime DOM preservation. Existing recorded runs support 12/12.

### 2026-10-05 — independent SPEC-02 acceptance regression; reopened

- Independent acceptance of HEAD `11ec942` rejects a partial `Known` title for `<h1>Known <span {...runtimeProps} /></h1>`. The nested intrinsic spread can supply runtime children; criteria 4/9 are contradicted and unchecked. Earlier static/recma/source/code/anchor checks remain historical evidence, not proof for this missing combination.
- Execution in-progress; triage Status unchanged. Repair and real packaged TOC-only/combined/repeated/late warning controls are required before closing. Parent and ADR 0002 static boundary remain unchanged. New evidence: session `20261005-0050-semantic-acceptance-repairs/`.

### 2026-10-05 — SPEC-02 repaired and independently reaccepted

- Root cause: title recursion treated a spread-bearing intrinsic descendant as fully static. `execution/navigation.ts:37–62` now rejects runtime child-bearing spreads/expression-valued children when deciding complete title certainty; it neither infers attribute text nor evaluates expressions/components. Original JSX and legal explicit-ID reservations remain; existing target-warning classification is preserved.
- Criteria 4/9: formal `test/integration/content-mdx-static-descendants.tests.ts` first fails the actual partial `Known`/`known`, missing warning and invented-anchor behavior (37 cases, 30 failures including parents). Rebuilt GREEN proves TOC-only, both code/TOC orders, repeated/late TOC, exactly one record-owned warning, quiet source/code, static `Known More`/`known-more`, comments/attributes-not-text, nested expression children and preserved forward known IDs.
- All 12 original criteria retain their actual API/type/recma/provisional-failure/detachment/asset evidence; original `content-mdx-navigation`, `content-mdx`, composition/recovery/transaction controls pass. Lead formal four-file strict suite 89/89 on Node 26.10.0 and minimum 22.13.0; lead affected suite 213/213 and complete build→test/minimum suites 588/588 each. Actual new installed archive consumer (not workspace link) passes 152 groups each runtime, including late TOC/real target structure; strict actual API/generated declaration types pass in both resolution modes/runtimes.
- Independent Standards `ses_ef626adc5ffe7EtrdJlMgi90vX` PASS / Spec `ses_ef626ad9cffekEYAAOlEEN1Qph` PASS, zero confirmed issues, inspecting actual unstaged diff and new tests. Session `regressions.md`, `verification.md`, `integrated-review.md`, `acceptance-audit.md` retain RED→GREEN and mappings. Restore 4/9 and completed only after these gates; Ticket 12 still performs final integrated acceptance. Status and immutable parent/ADRs are unchanged; no staging/commit/publication.

### 2026-10-05 — final integrated reacceptance

- After an additional native-cache identity correction, unchanged navigation regression/oracles pass again in formal90/90 and final complete589/589 on both runtimes. The freshly installed `aac3dae...` archive consumer passes153groups each, including nested descendants/late/repeated TOC/quiet source-code/static titles/legal reserved targets and actual generated anchors; all4strict actual API/generated type commands exit0. Latest actual-diff Standards/Spec rechecks both PASS0, followed by another full build→test/minimum/package/docs cycle. Final commands/bytes/143-item mapping are recorded in Ticket12 and session `20261005-0050-semantic-acceptance-repairs/`; prior588/152 evidence remains history, not the latest package result. No static boundary/public contract is changed.
