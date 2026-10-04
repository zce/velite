# 11: Migrate consumers and remove the obsolete content path

Status: ready-for-agent
Execution: completed

**What to build:** Upgrading users see one documented, correctly typed content API, and the implementation no longer carries the legacy hybrid roots or copied-artifact execution path introduced by the temporary migration.

**Blocked by:** 07 — Navigate statically known MDX headings after complete Transform.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Migrate all supported consumers, examples, public usage/migration documentation, package/type tests, generated-type assumptions, and benchmark callers to explicit Content Definitions and ordinary result schemas.
- [x] Examples with related generated content/navigation/analysis intentionally reuse one definition for the same selected input rather than create equal-looking separate definitions expecting inferred sharing.
- [x] Remove the old hybrid Markdown/MDX schema roots and equivalent aliases from the public runtime/type surface. Do not restore inferred-dialect standalone projections, `original`, upstream TOC options, metadata tuning, or a generic custom projection protocol.
- [x] Remove obsolete inferred profile equivalence, pristine artifacts, VFile seed copying, transform-branch materialization, cloneability eligibility/restrictions, and old content retained-slot/branch inspection interfaces that no longer serve the accepted execution design.
- [x] Remove migration-only routing/coexistence once callers have moved. No permanent compatibility family, bridge, method stub, abandoned implementation, or “cleanup later” debt remains for this content migration.
- [x] Preserve unrelated established built-ins and intentionally public contracts. Do not remove adjacent runtime/effect capabilities solely because they share a module or belonged to an older workstream.
- [x] Replace obsolete source-only TOC/no-transform, profile-coalescing, branch-copy, unsupported-seed, and title-slug expectations with the reviewed behavior, retaining relevant existing regression coverage instead of deleting tests wholesale.
- [x] Package exports, built declarations, export maps, and generated collection declarations agree on the concrete finite definition/result API. Ordinary Zod inference works, and internal processors/artifacts/hosts/carriers/transactions/caches remain absent.
- [x] Document source-versus-navigation semantics, explicit identity/input reuse, native wrappers and preprocessing, failure dependencies, consumer detachment, actual anchors, dynamic heading limitations, runtime ID forwarding, and TOC-only asset/plugin I/O.
- [x] Align active content-architecture guidance with the now-migrated implementation and the scoped supersession recorded by Ticket 01. Preserve historical reasoning, unaffected transaction obligations, and unrelated publication decisions; leave the parent spec unchanged.
- [x] Representative migrated examples exercise configuration self-reference, and packaged consumer type fixtures build correctly without the legacy path. Existing build, runtime-neutral, and dependency-boundary checks remain green.
- [x] The complete migration stays scoped to the approved implementation branch; no intermediate partial API is represented as the final 1.0 surface.

## Scope and verification

This is the approved contract phase of the bounded expand–contract migration, not a new compatibility layer or a reason to refactor unrelated code. It can start when all target methods exist; it does not need unrelated hardening tickets to begin. Verify migrated packaged consumers, declarations, supported examples, and deliberate absence of legacy internals/surfaces. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — contracted implementation and remaining integration gate

- Removed legacy hybrid roots, standalone projections, profile/broker/seed/branch-copy machinery, retained-slot interfaces and coexistence routing. Pure public content options/results and eight-field schema context remain; no generic custom projection API or compatibility aliases were introduced. Existing unrelated file/image/slug/unique/effect capabilities were preserved.
- Migrated all example definitions, usage/migration/API/type docs, package/consumer tests and existing benchmark caller. Related selections explicitly reuse one definition. Active module/schema/error guidance now describes the implemented owner, preserving scoped historical supersession notices and the immutable parent.
- Existing regression mapping is recorded in session `progress.md`; obsolete clone/branch-layout assertions were replaced with packaged ordinary continuation, private-state, selected-input, actual-anchor and independent-definition observations. Genuine neighboring built-in behavior remains tested.
- Lead verified build → selected migrated tests (133 passed), then build → complete test suite (453 passed, no skips), packaged nextjs/vite example builds and their actual generated consumer declarations (3 passed), plus `pnpm docs:build` (passed after repairing a dead link in the changed type reference). Agent formatting claims alone were not used as product verification.
- Independent core review found actual stage/asset/navigation/compiler defects; lead reproduced each before fixing them at its narrow boundary. New packaged review regressions cover atomic promotion, callback routing, non-stringifiable failures, mixed HTML comments, MDX comment headings, cross-realm compiler bytes, and invalid non-expression JSX IDs. Mutual wait/Parse-close/terminal-gate regressions use the existing source runtime/record seams.
- **Not closed:** an additional nested native Zod abandoned-aggregate regression is now deliberately present and fails the complete gate (see 09). All remaining independent migration work has been integrated; completion requires the unresolved dependency/architecture decision plus a fresh full build/test and both independent review axes. This ticket is not marked completed merely because the pre-regression 453-test run passed.

### 2026-10-02 — checked criterion mapping and final blocked gate

- Criteria 1/2: `examples/{basic,nextjs,vite}/velite.config.*`, migrated docs/reference/guide pages, `scripts/bench-large.ts`, existing/new API/type fixtures. Packaged basic, nextjs, vite and consumer declaration tests pass in the latest full run; bounded source searches find no active example legacy calls.
- Criteria 3–5: `src/core/schema/{content,s,builtins,index}.ts`, pure `content/options.ts` / `results.ts`, private `content/execution/`, `schema/capability.ts`, builder/pipeline/validate wiring. Old files are deleted, live source search finds no profile/pristine/seed/branch/broker path, and packaged runtime/type absence checks pass. Unrelated committed-effect overloads are pre-existing contracts, not content coexistence.
- Criteria 6/7: built-in/asset/unique/API/runtime-neutral regressions pass; replacement continuation/opaque state/selected input/failure/close/detachment cases map to the packaged suites and existing record-runtime tests listed in session `progress.md`. Only obsolete private layout/copy eligibility assertions were retired.
- Criteria 8/11: `test/dist-contract.tests.ts`, `test/fixtures/ts-consumer/consumer.ts` and `test/integration/content-examples.tests.ts` verify actual built/export-map/generated consumer declarations, finite factories/result types and absence of internal machinery. Source build and all corresponding consumer/runtime-neutral/dependency checks pass.
- Criteria 9/10: `docs/guide/content-executions.md`, migration/schema/type/API references and active `.agents/knowledge/` guidance contain the required semantics and explicit source/TOC/runtime/plugin limitations. VitePress build passes. Historical body changes are scoped supersession notices; original index, immutable parent, CONTEXT/ADR 0001 and CLAUDE deletion are preserved.
- Criterion 12: branch/HEAD/version are unchanged; no final 1.0 acceptance, publication or release was represented. All eight methods are working, with no content compatibility family or placeholder method.
- **Execution remains blocked despite these factual criterion checks:** latest build succeeds; full test gate is 463 tests / 462 pass / 1 native nested-Zod failure / 0 skips. Standards fix recheck passes; Spec fix recheck confirms no new defects but cannot pass whole integration while 09 remains unresolved. `12` is not started. These checks are not a substitute for the required green full gate and final acceptance.

### 2026-10-02 — resumed after architecture authorization

- User explicitly authorized the private schema Promise-observation runtime boundary in ADR 0003. Implementation/integration resumed without changing parent requirements, public API or native wrapper semantics. The 09 strict regression stays mandatory; a fresh green full gate and independent review will close 09/11 before starting 12.

### 2026-10-02 — complete migration gate passed

- The authorized private observer repaired 09's genuine native-chain blocker without compatibility schemas, wrapper rewrites, swallowed original errors or changes to the eight-field/public package surface. Removed the redundant content-only Promise subclass as well as all previously contracted roots/profile/seed/branch paths. All migration criteria above remain mapped to real consumer/source/type/docs observations.
- Restored the migrated existing benchmark's default MDX minification, preserving workload comparability. No cheaper `minify: false` result is represented as the old benchmark's replacement cost.
- Lead `pnpm build` → `pnpm test`: **482/482 passed**, no failures/skips/cancellations. Full Node 22.13.0 runtime suite also **482/482**. Fresh `pnpm docs:build` passed; Prettier check passed for all 131 actual non-deleted task files. Logs: session `09-11-observer-verification.md`.
- Independent Standards and Spec reviews (`ses_f0465d22affer3704Kjomp3f7f`, `ses_f0465d229ffeQ55PLp2p7awTr7`) both PASS for actual unstaged/new integration; prior DI/classifier/cycle/temp-path findings are confirmed repaired. Lead verified the protected original index/HEAD/parent/CONTEXT/ADR 0001 and CLAUDE deletion. Execution completed; Ticket 12 may now begin. This is implementation acceptance of migration, not external release/publication approval.

### 2026-10-02 — final integrated migration regression verification

- Final actual rebuilt runtime/consumer/full suites pass **499/499** on Node 26 and official minimum Node 22.13.0, including basic/nextjs/vite packaged self-reference and generated-type consumers. Final real extracted local tarball passes both dialects/full/no-op/incremental/actual config replacement, finite runtime/export-map absence checks, complete positive/negative API tsc and actual generated collection field tsc (`12-final-verification.md`, `12-package-verification.md`).
- Final `pnpm docs:build` passes. Targeted live source search finds no superseded roots/profile/broker/seed/copy-branch/coexistence route or content Promise subclass. No placeholder or compatibility debt remains; intentionally unrelated pure identity helper and existing runtime/effect contracts remain.
- ALL12 Standards and Spec final code rechecks both PASS against actual unstaged plus new files, excluding the protected initial staged documents/deletion. Parent/CONTEXT/ADR 0001 bytes, starting HEAD/index fingerprint and CLAUDE deletion remain unchanged. Branch/version remain unchanged; no commit/stage/external publication or release approval is inferred.
