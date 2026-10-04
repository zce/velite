# 06: Navigate transformed Markdown with actual Heading Anchors

Status: ready-for-agent
Execution: completed

**What to build:** Markdown Navigation TOC links to the actual headings in generated HTML after content plugins run, with deterministic collision-free automatic targets and preserved legal explicit IDs.

**Blocked by:** 04 — Emit Markdown HTML from the same owned execution.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Expose a working ordinary Markdown TOC schema returning detached flat depth/title/id items, in transformed document order, with correct package/Zod/generated types and no `slug` or TOC option family.
- [x] Run controlled anchor assignment/navigation capture after user content transforms at the Markdown content-tree point, including supported intrinsic raw HTML headings. Added/removed/renamed/reordered/retargeted headings are reflected in navigation.
- [x] Reserve legal statically known explicit IDs from all current content elements before allocating missing heading IDs, including later elements and non-heading targets. Preserve explicit targets and implement the reviewed Unicode/base/suffix allocation contract.
- [x] Diagnose invalid/conflicting explicit IDs according to the concrete contract instead of silently choosing a winner or rewriting a legal target. Automatic IDs avoid all reserved/generated targets and handle suffix and empty-base collisions.
- [x] HTML-only generation also receives the controlled automatic anchors; output processing is not conditional on a TOC field arriving first. TOC and emitted HTML agree on actual targets when the execution succeeds.
- [x] TOC-only demand completes Transform and skips compiler serialization/Emit. A later HTML request resumes from the completed run without reparsing or rerunning transformers.
- [x] Keep captured navigation provisional until the complete run succeeds. Transform failure yields no successful TOC, preserves successful Source Analysis, and retains rejection without retry; Emit-only failure leaves completed navigation valid.
- [x] TOC-only can perform normal transform I/O and linked-file asset resolution. Those Velite-owned declarations use the same successful-stage one-time eligibility and valid-record gate as HTML demand.
- [x] Repeated/concurrent TOC and HTML consumers do not duplicate stages, effects, or shared warnings. Deliver fresh arrays and item objects rather than mutable internal snapshots.
- [x] Preserve truthful source/field attribution and the concrete static-capability boundaries; navigation does not infer surrounding layout, CSS visibility, or runtime DOM.
- [x] Add independent expected values for Unicode, composed/decomposed text, duplicate titles, forward/non-heading reservations, suffix collisions, explicit conflicts, and transformed order. Do not use the old pristine source outline as an oracle.

## Scope and verification

Compare packaged TOC data with actual transformed HTML targets and observe transform/compiler calls through ordinary plugins. Use existing record seams only for controlled failure/effect timing. No public AST, source-outline API, external slugger contract, or generic projection extension is introduced. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — implementation and two-axis acceptance

- Criteria 1–5, 10–11: pure two-pass `execution/navigation.ts` reserves every legal explicit element target before automatic allocation; plugin-replaced/reordered headings and raw HTML targets are reflected in packaged TOC and actual HTML. Exact independent fixtures cover Unicode normalization/marks/case expansion, suffix collisions, forward/non-heading targets, empty bases, explicit conflicts/validity and transformed order. Public/consumer types use `id`, not `slug`, with no TOC options.
- Criteria 6–9: TOC completes one Transform with zero compiler calls; late HTML resumes once. Actual asset resolution occurs for TOC-only; recovered compiler rejection retains completed detached navigation and pre-transform source. Transform conflicts reach both requesting fields, with no fatal duplicate path or winner.
- RED missing `toc` → GREEN 10 navigation assertions/subtests and prior source/HTML fixtures. `pnpm build` → `pnpm test`: 419 passed, 0 failures/skips; session `06-verification.md`.
- Separate lead Standards review passed for pure value algorithms, explicit record ownership, bounded snapshots and private delivery. Separate Spec review passed for actual-target agreement, unconditional generated anchors, failure dependencies and independently specified values. MDX navigation is still deliberately unadvertised until 07. Subagent quota fallback applies.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–5, 10–11: `src/core/content/execution/markdown.ts:52` appends controlled capture after user content transforms; `src/core/content/execution/navigation.ts:20` and `:65` implement Unicode bases and full explicit-ID reservation/conflict checks. `test/integration/content-navigation.tests.ts:8`, `:39` and `:113` independently compare transformed TOC order/IDs with actual HTML targets, including HTML-only output and invalid explicit targets; consumer types use `id` in `test/fixtures/ts-consumer/consumer.ts:80`.
- Criteria 6–9: `test/integration/content-navigation.tests.ts:8` and `:148` observe one Transform, zero TOC-only compiler calls, late Emit and real asset publication despite recovered Emit failure. `src/core/content/execution/record.ts:148` withholds navigation until Transform succeeds and `:194` copies every delivered item; `test/integration/content-composition.tests.ts:28` proves concurrent/late mutation isolation. Recorded runs cover these assertions without a runtime DOM guarantee.
