# 02: Discard effects from invalid records

Status: ready-for-agent
Execution: completed

**What to build:** A build excludes every failed record's asset and uniqueness declarations while retaining valid records' declarations, so that sibling schema work cannot contaminate committed build state.

**Blocked by:** 01 — Record concrete content and anchor contracts.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Collect candidate effects in one record-owned transaction rather than appending them to a source-wide committed/candidate array before record validity is known.
- [x] A record with a successful asset/uniqueness sibling and a failed required sibling contributes neither its entry nor any of its effects to the downstream valid-record candidate. Another valid record in the same source retains its entry and effects.
- [x] Record validity follows the final native Zod outcome. A recovered issue or discarded wrapped value alone is not grounds for invalidation; an unhandled issue or thrown record operation cannot promote the record's effects.
- [x] Successful record finalization promotes its eligible declarations once; validation failure or a thrown operation discards the record transaction.
- [x] Close the declaration boundary on every settlement path. A captured `collectEffect` invoked after record finalization rejects deterministically and cannot append, reopen, or mutate the settled transaction.
- [x] Preserve the existing public effect declaration/context boundary and unrelated built-in schema behavior. Do not add a service to the public schema context or expose the transaction.
- [x] Existing full and incremental builds consume only valid-record candidate effects. Preserve the separate cross-record/build validity checks rather than treating record promotion as physical publication.
- [x] Demonstrate the invalid-sibling, valid-neighbor, recovered-record, thrown-operation, and late-declaration cases through existing build/record seams with actual asset/unique observations, not private collector-count assertions.
- [x] Keep current callers and tests working during the approved migration. This ticket does not implement or preserve a new compatibility API.

## Scope and verification

Fix the record-atomic gate at its narrow correct boundary. Full diagnostic normalization, declaration-protocol redesign, Builder coordination, generation/publication, and cleanup are excluded. Prefer public build observations, supplement with the existing memory runtime and record-validation harness for late declarations, and run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — lead integration and acceptance

- Criteria 1–4: validate owns `candidateEffects` per record, closes acceptance on native Zod settlement, promotes once only on success and clears in `finally`. Packaged invalid-sibling/valid-neighbor, catch/optional recovery and thrown-operation tests observe actual entries, assets and unique diagnostics.
- Criteria 5–6: raw record collector and Runner's captured public collector reject after settlement. Success, unhandled Zod issue, synchronous/async throw and barrier-controlled late sibling are covered; reflection and packaged TypeScript keep exactly eight public fields.
- Criteria 7–9: packaged durable Builder transitions compare incremental/full output and asset removal; existing cross-record/build checks are preserved. No new compatibility API was added.
- Lead reproduced a real PromiseLike context failure (targeted suite: 9 pass, 1 fail). Fixed assimilation inside `host.run`'s async callback without changing the host or native wrappers.
- `pnpm build` → `pnpm test`: 393 passed, zero failures/skips/cancellations. Standards lead review: narrow validity gate, explicit ownership, public carrier separation and existing declaration shapes preserved. Spec lead review: all nine criteria mapped above; no Builder/publication scope expansion. Independent reviewer tool was unavailable due to usage limit; reviewed both axes separately under the authorized fallback.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–6: `src/core/pipeline/validate.ts:112`, `:184` and `:207` own candidate effects, gate promotion on the native result and close every settlement path; `src/core/schema/runner.ts:68` leases the captured public collector without changing the eight-field view. `test/core/pipeline/validate.tests.ts:41`, `:85`, `:137` and `:201` assert late calls, thrown operations and invalid-record effects through the existing memory build boundary.
- Criteria 2–4, 7–9: `test/integration/record-effects.tests.ts:35`, `:69`, `:127` and `:173` observe real entries, asset output, unique conflicts, native recovery/optional behavior and full/incremental agreement. `test/core/pipeline/validate.tests.ts:240` covers PromiseLike assimilation inside the active host scope. Existing recorded regression runs support retaining 9/9; no new compatibility API is required.
