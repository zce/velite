# 08: Preserve native Zod recovery and detached shared results

Status: ready-for-agent
Execution: completed

**What to build:** Consumers compose and recover shared Markdown/MDX result schemas using ordinary Zod behavior, with field-accurate issues, execution-level warnings, and mutation-isolated delivered values.

**Blocked by:** 07 — Navigate statically known MDX headings after complete Transform.

**Parent:** Velite 1.0 — Semantic Content Executions; follow ADR 0001 and the concrete contract delivered by Ticket 01.

## Acceptance criteria

- [x] Normal transforms, refinements, supported wrappers/unions, and custom black-box schemas compose the result schemas with correct input/output inference; no wrapper override or wrapper-graph scheduler is introduced.
- [x] Preserve the supported Zod version's actual `.optional()` behavior. Do not promise zero work or a selected-body-presence policy; requests already received remain requested even if an outer wrapper discards the derived value or suppresses an issue.
- [x] Explicit ordinary preprocessing/input selection demonstrates derivation only when the intended body exists. Empty selected input still takes the zero-content-demand guard rather than using a new body-presence option.
- [x] `.catch()` recovers ordinary content/Zod issues without retrying a rejected stage or adding a hidden duplicate fatal diagnostic that invalidates the recovered record. Directly thrown invariant/lifecycle faults escape validation fallback.
- [x] Exercise the complete dependency matrix for both dialects: Parse failure affects every selection; complete Transform failure affects navigation/generated output but not completed Source Analysis; Emit/minification failure affects generated output only.
- [x] Concurrent/repeated requests observe retained success/rejection without duplicate stage work. A successfully completed lower selection remains available after a caught higher failure, regardless of sibling ordering.
- [x] Successful controlled lower-stage effects remain eligible when the higher failure is recovered and the final record is valid; failed-stage effects remain discarded. Unhandled required-field failure still invalidates the record and discards all its effects.
- [x] Every delivered TOC array/item and metadata object is detached. A user transform mutating one delivery cannot affect another concurrent or later delivery or the internal snapshot; plugin-private values are not recursively frozen as a substitute.
- [x] Shared warnings are finalized once by the record/execution, not attributed to the first requesting field. Field-local issues retain each consumer's normal Zod path, and requested-capability limitations handle late requests.
- [x] Normal VFile/message mutation and replacement are reflected at finalization. Do not snapshot messages too early or duplicate them per consumer, and do not fabricate original-file coordinates for unmapped selected/transformed text.
- [x] Ordinary user-defined schema composition gains no public broker, pristine AST, VFile, generic recipe, or internal lifecycle surface. Runtime exports and consumer types remain aligned.

## Scope and verification

Use packaged schemas/build output and actual supported Zod composition, with existing record/runtime seams for controlled failure ordering. Assert values, consumer paths, shared warning ownership, effect eligibility, and genuine mutation isolation. The version-specific optional probe is evidence, not a cross-version scheduler contract. Run `pnpm build` before `pnpm test`; complete diagnostic-model and prepare-protocol redesigns are excluded.

## Comments

### 2026-10-02 — implementation and two-axis acceptance

- Criteria 1–4, 11: packaged native nullable preprocessing, unions, refine/pipe, default/prefault and custom async black-box composition; native optional actually runs inner content/asset work while omitting the output key. Direct content invariants escape catch. No wrappers overridden, graphs inspected or public internal seam added; consumer types regress.
- Criteria 5–8: both dialects' complete Parse/Transform/Emit matrix has independent retained values and exactly one failure per execution. Concurrent/late TOC arrays/items and metadata mutations remain local; actual generated IDs remain uncorrupted. Lower-stage/invalid-record effects from 02–07 regress, including native optional retained linked assets.
- Criteria 9–10: RED reversed field keys changed shared warning order; fixed narrowly by existing `compareDiagnostic` at record handoff, without changing the diagnostic model. Final replacement/compiler messages and consumer paths remain accurate and unmapped text has no fabricated coordinates.
- Corrected fixture expectations to native Zod object behavior (an absent optional key is omitted; the black-box required input is explicitly provided). No production validation was relaxed. `pnpm build` → `pnpm test`: 443 passed, 0 failures/skips; session `08-verification.md`.
- Separate lead Standards review passed for unchanged native schemas/context boundary and canonical diagnostic reuse. Separate Spec review passed for full dependency matrix, genuine detached delivery, recovery/effects and version-specific optional behavior. Subagent quota fallback remains in effect.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–4, 11: `test/integration/content-composition.tests.ts:56`, `:72` and `:123` assert actual native optional work, explicit preprocessing, unions/refine/pipe/default/prefault/black-box composition and thrown invariants. `test/core/schema-selected-input.tests.ts:78` preserves the zero-demand empty-input guard; `src/core/schema/content.ts:34` returns ordinary Zod schemas and `test/fixtures/ts-consumer/consumer.ts:80` checks concrete types.
- Criteria 5–8: `test/integration/content-composition.tests.ts:28` and `:95` independently assert concurrent/late DTO mutation isolation and both dialects' retained Parse/Transform/Emit matrix. `test/integration/content-html.tests.ts:50` and `:81`, `test/integration/content-mdx.tests.ts:79` and `test/integration/record-effects.tests.ts:35` observe lower-stage eligibility versus failed-stage/invalid-record asset exclusion.
- Criteria 9–10: `test/integration/content-composition.tests.ts:8` compares reversed consumer order; `test/integration/content-html.tests.ts:30`, `test/integration/content-mdx.tests.ts:106` and `test/integration/content-mdx-navigation.tests.ts:39` assert final replacement/compiler messages, canonical shared ownership and late requested-only warnings without fabricated coordinates. Existing recorded runs support 11/11.
