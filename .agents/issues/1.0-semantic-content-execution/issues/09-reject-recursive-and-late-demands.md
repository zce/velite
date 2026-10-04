# 09: Reject recursive and late demands without reviving record state

Status: ready-for-agent
Execution: completed

**What to build:** Recursive or late Markdown/MDX content requests fail predictably instead of hanging or reviving closed processing, while normal concurrent consumers and separate record/build lifetimes remain correct.

**Blocked by:** 05 — Derive MDX Source Analysis and emit MDX code.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Reject a demand that would await its own current or ancestor pending execution/stage. Cover direct recursion and ancestor recursion through another execution without introducing a public dependency DAG.
- [x] Independent concurrent waiters still reuse in-flight work; the guard must not misclassify ordinary sharing as recursion. Already completed lower-stage selections can remain valid when they do not create a pending wait cycle.
- [x] Recursive and closed-scope faults are invariant/lifecycle failures, not successful validation fallback values. They cannot be concealed by ordinary `.catch()` recovery.
- [x] Record close is terminal and idempotent on successful validation, Zod failure, or thrown operation. Basic ownership/close safety established in earlier slices is preserved rather than postponed to this ticket.
- [x] Controlled pending Parse, Transform, and Emit settlement after close cannot start a higher stage, promote effects, reinsert cache state, or resurrect superseded tree/file references.
- [x] Late captured content/effect capability calls reject without reopening leases/journals. Calls from async plugin callbacks and legal replacement-file continuations follow the active scope while valid and cannot promote after scope closure.
- [x] Execution state is never reused across distinct records, independent builds, actual revalidation attempts, or configuration replacement. A definition may outlive records; its processor/tree/file may not.
- [x] Preserve legitimate outer validation memoization: an unchanged record need not be revalidated solely to demonstrate isolation, but a new actual validation must own fresh processing state.
- [x] Completion promises retain no obsolete raw phase trees/files merely as fulfilled values. Release module-owned references at close and supersession; do not claim to revoke references independently retained by plugins.
- [x] Retain bounded semantic snapshots and only the current continuation needed for future stages. No content artifacts enter the file model, session store, ambient host, or a process cache.
- [x] Use no mutable process-wide stage pointer, public lifecycle hook, new retained-slot counter, general instrumentation service, or GC-timing correctness assertion.
- [x] Deterministic barrier-based tests cover recursion, normal overlapping requests, repeated close, late success/rejection/declaration, and record/build/configuration isolation. No timing sleeps or arbitrary plugin-global concurrency guarantee is used as an oracle.

## Scope and verification

This slice delivers adversarial asynchronous behavior through existing production request/record-close boundaries, not an independent internal lifecycle layer. Prefer build/durable Builder for isolation and use existing record/runtime interfaces for controlled pending work. Review ownership/release paths directly and run `pnpm build` before `pnpm test`. Unrelated Builder cancellation, generation fencing, and publication/cleanup redesigns remain excluded.

## Comments

### 2026-10-02 — adversarial implementation and acceptance

- Criteria 1–3: RED direct higher-stage recursive demand timed out; fixed finite-stage ancestor guard now rejects same/ancestor pending waits, including across executions, while completed lower facts and independent overlapping waiters remain valid. Catch cannot conceal these internal faults.
- Criteria 4, 6: existing memory Builder/SchemaRunner boundaries close records while Transform waits on a release barrier and real MDX Emit/minification is pending; tested late continuations and captured declarations cannot restart or promote. Parse-origin async capabilities reject after their own stage closes even while the record remains live. Dispose/close cleanup is idempotent. Controlled pending-Parse coverage remains an audit gap below; no sleeps or added public counters were used.
- Criteria 7–11: actual records/builds/revalidation/config reload receive fresh processors; unchanged outer memo legitimately does not revalidate. Failure/Emit/close release current raw continuation, adapters guard late capture, record clears all semantic/stage references. Fulfilled stage values are void, not raw trees/files; host/store/file gain no artifacts.
- Production early-synchronous-sibling fixture reproduced an abandoned Zod content chain under `--unhandled-rejections=strict` (exit 1). A private `ContentPromise` observes only content-derived chains, preserving rejection for actual waiters; fixture now exits 0. No global rejection handler, native wrapper override or invariant-to-issue conversion. Native aggregate/user-created promises are not a general cancellation service.
- `pnpm build` → `pnpm test`: 456 passed, 0 failures/skips; session `09-verification.md`. Separate lead Standards review passed (private host metadata/DI, bounded ownership, no Builder/publication rewrite); separate Spec review passed (14 lifecycle tests/subtests plus packaged regressions).
- Lead rechecked starting HEAD, index SHA-256, unchanged parent bytes and existing CLAUDE deletion: all preserved. Subagent quota fallback remains in effect.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–4, 6–8: `src/core/content/execution/record.ts:119` guards same/ancestor pending waits; `test/core/content-execution.tests.ts:35`, `:62` and `:90` distinguish recursion from overlap/completed lower facts. `:211`, `:236` and `:266` assert closed-stage calls, fresh actual record/build/config lifetimes and terminal raw capability rejection. `test/core/pipeline/validate.tests.ts:41`, `:85` and `:137` cover successful, thrown and Zod-failed record settlement; replacement-file continuations are observed in the packaged HTML/MDX suites.
- Criteria 9–11: stage memos in `src/core/content/execution/record.ts:119` fulfill with `void`, while `:226` clears execution/journal lookup and snapshots. `src/core/content/execution/processor.ts:39` and `:86` release current raw references; the host/file/store remain propagation/data boundaries, not artifact owners. `src/core/schema/content-promise.ts:1` observes only content-owned derived chains; the strict fixture does not establish native aggregate cancellation.
- Criteria 5 and 12 remain unchecked: `test/core/content-execution.tests.ts:134` provides no entered/release barrier for Parse, and `:189` deliberately skips waiting for Parse entry. Its two Parse success/rejection labels follow the same path because `rejectLate` only affects Transform/compiler behavior. The active checks at `src/core/content/execution/record.ts:138`, `:144`, `:148` and `:152` support the intended fence, but the recorded 456/458 passes do not prove controlled already-started Parse success/rejection after close. This is a verification gap, not a demonstrated implementation failure; add that deterministic case before checking these two criteria.

### 2026-10-02 — integration regression, verification repair, and dependency blocker

- Criteria 5/12 now have genuine entered/release barriers in `test/core/content-parse-close.tests.ts`, using the existing dialect factory DI and production record-validation boundary. Real Parse completes its initial work, waits, then succeeds or rejects after forced finalization; neither branch runs Transform/Emit or promotes the buffered early/late declarations. Both cases passed. The earlier mislabeled Parse subtests were replaced, not retained as evidence.
- `test/core/content-execution.tests.ts` now proves independently started mutual waits reject rather than deadlock and terminal close rejects raw pending requests _before_ releasing a blocked plugin. A private record terminal rejection gate fixes the latter reproduced timeout, without draining plugin work or changing Zod recovery. Late stage outcomes remain observed and fenced.
- Initialization-registered asynchronous callbacks now resolve this execution's currently invoked stage, with no process-wide stage pointer; `test/integration/content-review.tests.ts` proves successful Transform promotion and failed Transform discard. Truly late Parse-origin calls with no active stage still reject.
- **Execution reopened as blocked.** The new strict nested case in `test/fixtures/content-abandonment.ts` / `test/core/content-execution.tests.ts` is a real failing regression: native Zod aggregation abandoned by a later synchronous sibling fault eventually rejects outside any reachable content-owned Promise chain. A shallow observed-content-chain result does not establish harmless arbitrary nested native aggregation. The failing assertion is retained; no skip, weaker expectation, or catch-to-issue conversion is used.
- Independent dependency investigation reproduced object, tuple, intersection, and union abandonment with Zod 4.4.3, without Builder/content ownership. Zod owns the unreachable native Promise references and exposes no supported task-observation seam. A local pnpm patch would not fix published consumers because Zod is external; bundling a patched Zod would not repair parent schemas constructed by consumers' external Zod. Upstream main was inspected and does not already contain the needed fix.
- Existing architecture cannot provide a complete remedy while simultaneously preserving native schemas, rejecting lifecycle faults, avoiding schema/wrapper interception and global/platform Promise observation, and delivering through the current external dependency contract. Required decision: a viable dependency-side fix/support policy, or explicit authorization for a new scoped runtime Promise-observation boundary. Parent requirements and accepted semantics remain unchanged; 12 cannot start/close while this remains unresolved.

### 2026-10-02 — user-authorized architecture extension

- User selected **authorize private scoped observation** after receiving the concrete native Zod blocker and consumer-delivery constraints. ADR 0003 records the new private runtime boundary, explicit DI, original-outcome/native-schema preservation, no public context/service additions, scoped late descendants and process-default hook ownership.
- Execution resumed in-progress. The strict failing regression and all original criteria remain intact. No green full gate or completion is claimed until the real external/native/late-created chain, isolation, terminal cleanup and packaged path are implemented and verified.

### 2026-10-02 — authorized boundary verified and ticket closed

- ADR 0003 is implemented through the required private `PromiseObserver` runner dependency, Node-only V8 Promise hook/ALS adapter and one lazy process-default facade instance. The marker stores only a Boolean, not records, content, journals, Builders or Promise lists; own observation bookkeeping is masked. Actual operations/Promises/errors and native external-Zod composition retain their outcomes.
- Original strict abandonment regressions now pass without changing their oracles. Packaged consumer-native object/tuple/intersection/union chains, successful synchronous union selection, late-created chains after closure, exact thrown-error identity, inactive capability rejection, simultaneous builds and eight-field reflection are covered in `test/integration/content-promise-observation.tests.ts`. Adapter strict children prove unrelated/outside-derived work remains normally unhandled. Terminal record gates still close immediately without draining blocked plugins.
- Removed the superseded content-only `ContentPromise` workaround; `schema/content.ts` now returns a native demand chain. Existing Parse/Transform/Emit late-settlement, pending-stage cycles, completed-Parse non-cycle and effects tests remain required.
- Lead inspected actual changes and ran `pnpm build` → `pnpm test`: **482/482 passed, zero failures/skips/cancellations**. Official minimum Node 22.13.0 complete runtime suite: **482/482**; focused subset: **48/48**. Exact logs: session `09-11-observer-verification.md`. Supplementary observer cost/heap evidence is in `observer-costs.md`; representative packaged costs remain Ticket 12, not a universal memory guarantee.
- Independent read-only Standards (`ses_f0465d22affer3704Kjomp3f7f`) and Spec (`ses_f0465d229ffeQ55PLp2p7awTr7`) reviews both PASS after checking actual unstaged changes and new files against the protected starting boundary. Lead integrated their findings and verified all prior repairs. All twelve criteria now have actual implementation/evidence; Execution completed. Original index/HEAD/parent/CLAUDE deletion remain unchanged.

### 2026-10-02 — final integration regression verification

- Ticket 12's ownership review found that Boolean-only observer bookkeeping still inherited the host carrier. Lead reproduced at the existing runtime seam, then explicitly injected `runUnbound` from the facade: nested private `host.run(undefined, operation)` masks the carrier and restores actual callback context. No host ownership/reset/public field, schema wrapper rewrite or original Promise outcome change. Adapter regression observes the actual context rather than content-cache internals.
- Final source/full build → test and official minimum Node 22.13 runtime each pass **499/499**; all strict abandoned native combinators/union winner/late-created chains/exact-error/unrelated-work and deterministic Parse/Transform/Emit close/cycle/isolation regressions remain. Final actual tarball consumer passes both runtimes. `12-final-verification.md` and `12-observer-isolation.md` retain evidence.
- Final private runner observer microprobe measures selected-record overhead about 16.30 µs on Node 26 / 12.76 µs on Node 22; sampled heap stays approximately stable after another 30,000 operations. Representative mixed/demand/revalidation/config-changing retention measurements are in `12-final-costs.md`; higher RSS and a nonzero dropped-process heap are explicit tradeoffs, not a universal retention/GC guarantee.
- Final ALL12 Standards (`ses_f03b82630ffeg0MzWr4Jurg6EG`) and Spec (`ses_f03b825e4ffeCReF3r1jSk27lz`) code rechecks PASS. This ticket's completed state does not substitute for these affected-path regressions; no criterion or error oracle was weakened.
