# 10: Keep content effects behind cross-record and build validity gates

Status: ready-for-agent
Execution: completed

**What to build:** Content stage declarations become committed build contributions only when their stage, record, cross-record checks, and existing build policy permit it, so that shared or recovered processing cannot bypass validity gates.

**Blocked by:** 08 — Preserve native Zod recovery and detached shared results.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Demonstrate through builds that successful controlled stages make declarations eligible once per execution, not once per consumer; failed-stage declarations are discarded even when its result is replaced by fallback.
- [x] A recovered later-stage failure leaves eligible successful lower-stage declarations available only if the final record remains valid. An invalid sibling discards the complete record effect set, including successful content work.
- [x] TOC-only transformation and asset resolution participate in the same stage/record flow as primary output; requesting code/HTML later does not repeat or duplicate shared declarations.
- [x] Declarations from captured public capabilities and asynchronous plugin callbacks belong to the active stage, with no journal reopening after finalization. Simultaneous executions/records cannot contaminate one another's effect sets.
- [x] Cross-record uniqueness validation diagnoses all conflicting participants and prevents their complete record contributions/effect sets from entering the valid output/asset commitment. Non-conflicting valid records remain intact; do not select a winner by iteration or settlement order.
- [x] Preserve existing full/incremental build validity and asset publication boundaries. Repair missing necessary candidate filtering at its narrow correct boundary rather than introducing a generation/publication subsystem.
- [x] Effect eligibility, provenance, and duplicate handling do not choose the first requesting field or depend on consumer count, field order, or Promise settlement. Distinct independent definitions still perform their own ordinary work.
- [x] Managed asset output reflects only eligible valid candidates; the test distinguishes unpublished controlled declarations from reads/probes or direct plugin I/O that already happened. Do not claim that external plugin side effects are rolled back.
- [x] Late closed-stage/record declarations cannot enter the candidate, committed effect index, or downstream asset plan. Failed/stale candidate work must not mutate the previously valid state through a hidden promotion path.
- [x] Real regression scenarios cover multiple shared consumers, recovered Transform/Emit failure, failed required sibling, cross-record conflicts with assets, valid neighbors, and incremental transitions between invalid/valid candidates.

## Scope and verification

Prefer packaged/public builds and durable Builder transitions, with existing memory runtime ports for deterministic asset/effect observations. Preserve the public declaration/context contract. Unrelated generation pointers, staged publication, strict-policy redesign, complete diagnostic normalization, and cleanup/recovery work are explicitly excluded. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — transactional implementation and acceptance

- Criteria 1–4, 7–9: prior stage/recovery/optional/late-declaration fixtures regress with the real cross-record gate. Stage work remains once per explicit execution, eligibility is record-scoped, and asset reads/plugin I/O are not claimed rollbackable. Candidate collectors stamp canonical collection/source/index/record ownership for both existing declaration forms.
- Criteria 5–6, 10: RED conflicting records and linked assets were still emitted; fixed only emit's candidate boundary. Every conflicting participant and its complete effect set is filtered, while a valid neighbor remains. JSON-pair keys avoid delimiter collisions and collection-qualified owner keys distinguish equal raw record IDs. The existing incremental fast path now removes only the changed collection's asset ownership, preserving unrelated overlapping-collection contributions; no publication subsystem added.
- Packaged durable transitions conflict → valid → conflict match clean full builds and reconcile assets. Overlapping collections exercise uniqueness and asset ownership; original unique/record-effect regressions were updated deliberately to the approved no-winner contract, preserving a separate successful recovered/native-optional build assertion.
- `pnpm build` → `pnpm test`: 458 passed, 0 failures/skips; session `10-verification.md`.
- Separate lead Standards review passed for narrow candidate filtering, immutable previous-state patching and public context/declaration preservation. Separate Spec review passed for all participants, valid neighbors, canonical record provenance, stage/recovery effects and full/incremental agreement. Subagent quota fallback remains in effect.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–4, 7–9: `src/core/content/execution/record.ts:61` and `:119` route active declarations and promote successful journals once; `src/core/pipeline/validate.ts:112` and `:207` gate complete record effects. `test/integration/content-html.tests.ts:50` and `:81`, `test/integration/content-mdx.tests.ts:79`, `test/integration/content-navigation.tests.ts:148` and `test/core/pipeline/validate.tests.ts:201` observe recovery, TOC-only assets, invalid siblings and rejected late declarations. These are managed effect/output guarantees, not rollback of direct plugin I/O or general Builder cancellation.
- Criteria 5–6, 10: `src/core/pipeline/emit.ts:22` and `:65` diagnose/filter every conflicting owner; `src/core/driver.ts:383` and `:408` preserve full/incremental boundaries and unchanged collection ownership. `test/integration/content-transactions.tests.ts:8` and `:50` assert shared consumers, valid neighbors, all conflicting entries/assets removed, overlapping collections and conflict → valid → conflict agreement with clean builds. `test/integration/record-effects.tests.ts:69` and `:127` retain separate recovered/optional and invalid-sibling transition assertions.
- Regression evidence is the existing `.agents/sessions/20261001-1139-semantic-content-executions/10-verification.md:606`: 458 passed, zero failures/cancellations/skips. This checklist audit ran no builds/tests and does not accept the concurrent Ticket 11 migration or resolve Ticket 09's pending-Parse test gap. Status routing and completed execution metadata remain unchanged.

### 2026-10-05 — independent SPEC-01 acceptance regression; reopened

- In a single collection with shared/shared/valid records, collect truncates before cross-record uniqueness filtering. Both shared participants are rejected, but the valid neighbor is lost while its asset still publishes. Criterion 5 is contradicted and unchecked; criteria 6/10 require expanded literal full/incremental evidence rather than equality between two wrong outputs.
- Execution in-progress; retain candidates until validity is known, then preserve existing singleton ordering/selection/diagnostics. Verify entries, actual JSON, conflicts and independent asset bytes through conflict → valid → conflict and fresh full builds, plus normal list/single controls. No asset-policy/publication redesign. Session `20261005-0050-semantic-acceptance-repairs/`.

### 2026-10-05 — SPEC-01 repaired and independently reaccepted

- Root cause: `collect` irreversibly sliced before cross-record validity, unlike effects. `pipeline/collect.ts:31–34` retains complete canonical ordered candidates; `emit.ts:77–104` first excludes every conflicting owner, then applies the established valid-candidate EMPTY/MULTIPLE diagnostics and singleton choose-first projection. The existing valid-candidate asset policy/list behavior is unchanged; no Builder/publication/cleanup subsystem is added.
- Criterion 5, extended 6/10: `test/integration/content-single-validity.tests.ts:116`, `:150` independently asserts the remaining `valid` record, actual non-null JSON, both `shared` participant errors/provenance, no premature cardinality warning and only c.txt with original bytes. Initial full/durable full, conflict→valid→conflict and fresh independent full all use literals, never only full/incremental equality. All-conflicting `:121` requires EMPTY/null/no assets; six normal list/single zero/one/multiple controls preserve canonical ordering and assets from every valid candidate.
- Genuine old-dist RED: original 36 tests, 17 failures including parents; added all-conflicting control extends to 41 tests with 19 failures. New rebuilt 41/41 GREEN, included in lead strict formal 89/89 each Node 26.10.0/minimum22.13.0, affected 213/213 and complete build→test/minimum 588/588 each. Actual installed new tarball consumer verifies separate literal single/list transitions, JSON, diagnostics and bytes on both runtimes (152 total groups each). Original transactions/record effects/lower-stage recovery/late gates remain green, preserving criteria 1–4/7–9.
- Independent Standards and Spec PASS, zero confirmed findings, actual diff/new tests inspected; session `20261005-0050-semantic-acceptance-repairs/{regressions,verification,integrated-review,acceptance-audit,costs}.md` records mapping and bounded 500-candidate costs. Restore criterion 5 and completed only now; Ticket 12 final integrated gate remains separate. Status/parent/ADRs unchanged; no staging/commit/publication.

### 2026-10-05 — final integrated reacceptance

- Unchanged singleton literal41-test suite and original transactions/record-effects/assets/recovery controls pass again after the later native-cache correction: formal90/90 and post-latest-review complete589/589each runtime. Freshly installed `aac3dae...` archive verifies actual full/durable/fresh single/list data, JSON, every conflicting participant and asset bytes in153groups each; latest500candidate samples independently retain/serialize valid and499errors. Latest actual-diff Standards/Spec rechecks PASS0; Ticket12 and session `20261005-0050-semantic-acceptance-repairs/` contain final gates/cost limits/143mapping. No singleton asset-policy, publication or cleanup change; prior588/152 evidence is preserved history.
