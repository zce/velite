# 04: Emit Markdown HTML from the same owned execution

Status: ready-for-agent
Execution: completed

**What to build:** A consumer derives HTML and Source Analysis from one explicit Markdown execution, preserving ordinary plugins and controlled stage effects without replay or copied processing state.

**Blocked by:** 03 — Derive Markdown Source Analysis from explicit Content Definitions.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] The Markdown definition's ordinary HTML result schema works through the packaged build with correct Zod/generated types and the existing supported Markdown options/defaults.
- [x] Extend the original Parse execution through fixed complete Transform and Emit demands. Concurrent/repeated HTML and source requests reuse pending/completed outcomes; no transformer/compiler replay or arbitrary transform-prefix graph is introduced.
- [x] Keep one configured/frozen processor and current tree/file continuation. Follow final callback-style run tree and VFile replacements; downstream work receives the replacements, not an obsolete original file.
- [x] Preserve ordinary process-equivalent compiler/file handling, including `value`, `result`, and messages. Assert real downstream state and diagnostics rather than placeholder success-only tests.
- [x] Parser/transformer closures and opaque private state remain ordinary processor-owned values. Map/function/Symbol/WeakMap or cyclic state is not rejected merely because it cannot be cloned; a replacing plugin owns its intentional private-state transfer.
- [x] A source selection requested after HTML uses captured pre-transform facts even if plugins mutate/remove/replace the source tree. Metadata/excerpt meaning does not depend on sibling key or completion order.
- [x] Retain success/rejection for each stage without automatic retry. Parse failure affects all selections, Transform failure affects generated content, and Emit failure affects HTML only; successful Source Analysis remains available after later failure.
- [x] Ordinary content/plugin failures become requesting Zod issues without an uncaught duplicate fatal path defeating recovery. Internal invariant/lifecycle faults remain thrown faults.
- [x] Buffer Velite declarations under the active controlled stage. Promote a successful stage once per execution, discard failed-stage declarations, and preserve lower-stage eligibility when a later failure is recovered and the final record is valid.
- [x] Capabilities captured during an attacher resolve the active stage at invocation, including asynchronous transformer callbacks. Do not bind captured `collectEffect` permanently to Parse or use a mutable process-wide stage pointer.
- [x] Configured linked-file asset rewriting works through the normal asset flow with correct record ownership. Repeated HTML consumers do not duplicate the shared execution's declarations; direct plugin external I/O is not advertised as rollbackable.
- [x] Finalize shared warnings at the record/execution boundary and retain requesting field issue paths. Normal file/message mutation or replacement is observed without inventing original-source positions for unmapped selected/transformed text.
- [x] Retain only the current continuation and bounded semantic snapshots; clear superseded phase references and preserve terminal close/late-settlement guards from the source slice.
- [x] Keep the migration baseline green and advertise no unfinished methods. The reviewed automatic navigation contract is added by Ticket 06, not by silently reusing the old source-slug helper.

## Scope and verification

Demonstrate real HTML-plus-late-source output, stateful plugins, legal replacement, failure/recovery, linked assets, and stage-scoped effects through packaged builds and existing deterministic record/runtime seams. Use controlled barriers for concurrency, not sleeps. No generic instrumentation, publication rewrite, or public internal seam is introduced. Run `pnpm build` before `pnpm test`.

## Comments

### 2026-10-02 — lead implementation and acceptance

- Criteria 1–6: packaged `html()` and consumer inference; one configured/frozen continuation in `execution/processor.ts`, callback tree/file replacement, opaque Map/Symbol/cyclic closure state, late pre-transform source, and exact string/Uint8Array/opaque-result VFile handling. Six packaged HTML tests assert real outputs and observations.
- Criteria 7–12: retained Transform/Emit rejection, per-field issues and catch recovery; captured collector routes asynchronous callback/Emit declarations to active journals. Successful lower-stage asset declarations publish, failed-stage declarations do not; invalid siblings discard all. Linked assets and repeated HTML consumers use one transform. Final file message replacement/mutation is reported once with canonical record ownership and no invented coordinates.
- Criteria 13–14: completion promises contain no raw artifacts, current continuation releases on Emit/close, close guards remain; no unfinished navigation API or old slug behavior added. The comment-removal regression was reproduced RED and repaired at raw HTML's comment-node boundary without deleting surrounding content.
- `pnpm build` → `pnpm test`: 404 passed, 0 failures/skips; session `04-verification.md` records commands. Packaged compiler return forms were additionally verified before closure.
- Separate lead Standards review: factory DI, platform neutrality, ordinary plugin ownership, private stage carrier and eight public fields preserved; no unrelated rewrite. Separate Spec review: all criteria above mapped and dependency regression suite green. Subagents remain unavailable due to usage quota; lead reviewed actual unstaged and new files rather than an empty commit diff.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–6: `test/integration/content-html.tests.ts:8`, `:30` and `:118` assert shared actual HTML/late-source output, callback replacement and string/byte/opaque compiler results. `src/core/content/execution/processor.ts:46`, `:55` and `:75` keep the ordinary frozen processor and follow its final tree/file without copying private state; consumer types are checked in `test/fixtures/ts-consumer/consumer.ts:80`.
- Criteria 7–12: `test/integration/content-html.tests.ts:50`, `:81` and `:101` assert retained failures, requesting field paths, active async declarations, lower-stage eligibility and real linked assets. `src/core/content/execution/record.ts:61`, `:119` and `:202` route journals at invocation and finalize canonical warnings once.
- Criteria 13–14: `src/core/content/execution/processor.ts:39` and `:86` release current raw references; `src/core/content/execution/record.ts:226` closes the owner terminally. The recorded 404-test increment had no navigation stub; Ticket 06 subsequently supplied the actual anchor contract rather than the legacy source slugger.
