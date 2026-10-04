# 03: Derive Markdown Source Analysis from explicit Content Definitions

Status: ready-for-agent
Execution: completed

**What to build:** A consumer can derive Markdown excerpts and reading metadata from an explicit Content Definition through the packaged build, sharing one Parse execution without running downstream transformations.

**Blocked by:** 02 — Discard effects from invalid records.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Expose the working Markdown definition and ordinary excerpt/metadata result schemas through the package entry. Zod input/output inference and generated collection declarations reflect the concrete contract, not `any` or a hybrid schema root.
- [x] Assemble one deep record-scoped content module with explicit factory DI. It owns execution lookup, resolved options, dialect processing, stage outcomes, semantic snapshots, effect/diagnostic handoff, and terminal close. Pure value/schema helpers do not acquire artificial factories.
- [x] Same definition and exact selected string within one record reuse pending, successful, and rejected Parse work. Equal-looking separate definitions, different strings, and different records remain independent; aliasing an existing definition retains identity.
- [x] Resolve configuration once per execution, preserving supported defaults, precedence, and plugin order. Canonical source identity is fixed by the record rather than mutable VFile state.
- [x] Explicit primitive input wins over the file body; absent input uses the body; explicit empty input is not replaced by fallback. Missing/exactly empty text yields the field-local non-fatal issue `The content is empty` without a content demand or processor setup. Non-string input is a normal schema input error; whitespace-only text is processed.
- [x] Configure/freeze and parse one ordinary processor under the Parse scope. Source-only requests may execute attachers but not returned transformers, serialization, or minification; plugin-private values are not copied/frozen/rejected for cloneability.
- [x] Capture complete normalized static source text before mutation: ordinary text and static inline code in source order, with the contract's whitespace and exclusion rules. Retain bounded semantic facts, not a second AST or a public parse artifact.
- [x] Excerpt length defaults to 260 Unicode code points; explicit length must be a non-negative safe-integer primitive number or synchronously throw `TypeError`. Apply the exact code-point truncation, trailing trim, and one `U+2026` suffix outside the requested length, including zero-length and surrogate-pair cases.
- [x] Metadata consumes the full normalized source text using the independently written Latin regex, frozen CJK intervals, 0.56 weighting, division by 265, ECMAScript rounding, and minimum one minute. Verify range boundaries, mixed scripts, apostrophes, fractional values, and text exceeding old helper truncation limits.
- [x] Equal explicit/fallback text produces equal values. A non-empty source without visible text succeeds with empty excerpt and metadata reading time 1/word count 0; it is not an empty-input issue.
- [x] Parse rejection is retained without same-execution retry and reaches requesting schemas as recoverable content issues; invariant faults remain thrown. Successful Parse effects become eligible once, failed Parse effects are discarded, and both obey the record gate from Ticket 02.
- [x] Deliver detached metadata objects. Close is terminal/idempotent; late settlement cannot promote effects or repopulate owned state. Completion memos do not retain obsolete raw trees/files merely as fulfilled values.
- [x] Preserve the ambient host and eight-field public context; expose no broker, AST/VFile, processor, cache controls, registry, new test counters, or content-stage Engine graph. No execution artifact enters the file model, session store, or process cache.
- [x] Add only working methods for this increment, without placeholders for future HTML/TOC behavior. Existing callers remain usable only under the approved temporary migration, which must end in Ticket 11.

## Scope and verification

This slice delivers source-only Markdown behavior from package/config loading to generated data/types. Prefer packaged build and existing consumer-type tests, using ordinary plugin observations to establish demand/identity and independent written value oracles. Use existing record seams only where needed for lifecycle/effect observations. Run `pnpm build` before `pnpm test`; do not postpone this slice's tests to integration acceptance.

## Comments

### 2026-10-02 — lead implementation and two-axis acceptance

- API/type/input criteria (1, 3–4, 5, 10–11, 14): `src/core/schema/content.ts` exposes only working Markdown excerpt/metadata schemas; package/config loading tests cover alias identity, separate definitions, exact input separation, empty/no-visible-text and invalid inputs. Packaged consumer types prove `string | undefined` input and non-any metadata output.
- Ownership/demand/source criteria (2, 6–9, 12–13): `content/execution/record.ts` explicitly owns record-local lookup, once-resolved options, Parse outcomes, journals and close; `markdown.ts` owns one frozen processor/file/tree, and `source.ts` implements the exact full text, Unicode excerpt and frozen Latin/CJK metadata rules. Source-only plugin tests observe one attacher/Parse and zero transforms; 87 endpoint fixtures cover all 29 ranges independently. Parse rejection is shared without retry or hidden fatal diagnostic; failed journal declarations are discarded.
- Terminal delivery: each metadata is freshly calculated; record.close fences settlement and clears owned references. Existing record collector/lease tests regress; actual raw semantic capability after finalization rejects at the approved record seam. No public internal content field/cache/host state was introduced.
- RED: packaged source fixture failed because the new namespace was absent. GREEN: working source fixture and focused consumer/record tests passed. Corrected two test oracle mistakes (lexicographic record ordering and the established generated declaration spelling), without changing production semantics.
- Final `pnpm build` → `pnpm test`: 398 passed, no failures/skips. Full evidence: session `03-verification.md`.
- Separate lead Standards review: explicit factory DI and record ownership, eight-field public/private split, no opaque-state copying or unrelated design changes. Separate Spec review: criteria mapped above; no unfinished HTML/TOC methods exposed. Legacy remains only for approved coexistence through Ticket 11. Independent subagents unavailable (usage limit); no verification gate waived.

### 2026-10-02 — acceptance checklist audit

- Criteria 1, 3–5, 10–11: `src/core/schema/content.ts:34`, `src/core/content/execution/record.ts:73`, `test/integration/content-source.tests.ts:6` and `:30` cover ordinary schemas, exact identity/input lookup and retained Parse outcomes. `test/core/schema-selected-input.tests.ts:78` asserts empty/missing/non-string inputs make no demand; `test/fixtures/ts-consumer/consumer.ts:80` checks concrete inference.
- Criteria 6–10: `src/core/content/execution/processor.ts:46` captures source immediately after one frozen Parse; `src/core/content/execution/source.ts:10` implements static text, code-point excerpts and the complete metadata oracle. `test/integration/content-source.tests.ts:64` and `:94` independently assert Unicode truncation, full-text arithmetic and all 87 CJK endpoint fixtures.
- Criteria 2, 12–14: `src/core/pipeline/validate.ts:161` wires the record owner; `src/core/content/execution/record.ts:119` and `:226` retain void stage outcomes and terminal cleanup without public artifacts. Detached metadata is additionally exercised by `test/integration/content-composition.tests.ts:28`. The recorded 398-test slice exposed only working source methods; later HTML/TOC implementations do not turn that historical scope into a placeholder promise.
