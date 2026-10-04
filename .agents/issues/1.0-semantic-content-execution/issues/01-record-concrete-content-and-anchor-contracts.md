# 01: Record concrete content and anchor contracts

Status: ready-for-agent
Execution: completed

**What to build:** Give implementers and consumers one concrete Content Definition and Heading Anchor contract, so that the subsequent slices implement the same API and value rules instead of independently interpreting architectural proposals.

**Blocked by:** None (can start immediately).

**Parent:** Velite 1.0 — Semantic Content Executions; accepted architecture is ADR 0001, “Share semantic results of explicitly defined content executions.”

## Acceptance criteria

- [x] Record the concrete implementation contract using the spec's candidate `content` namespace, Markdown/MDX definition factories, and finite result-schema methods as the baseline. State exact exported names/types and supported options; distinguish this new contract from prior architecture approval. Surface any material departure for review rather than silently changing the API family.
- [x] A Content Definition is not a schema. Markdown result factories are `html`, `toc`, `excerpt`, and `metadata`; MDX factories are `code`, `toc`, `excerpt`, and `metadata`. Results are ordinary Zod schemas; processing options belong to the definition, and only excerpt length is selection-specific.
- [x] Record same-definition/exact-selected-input/record-local sharing, independence of separate factory calls, alias identity, configuration snapshot ownership, and canonical record source identity. Do not infer profile equivalence.
- [x] Record explicit-string precedence, absent-input file fallback, explicit empty-string rejection without processing, invalid input types, whitespace-only behavior, and native wrapper semantics without a zero-work optionality promise.
- [x] Record flat Navigation TOC values with depth/title/actual ID, eligible static headings, transformed document order, and downstream code-plugin/runtime ID-forwarding limitations.
- [x] Specify legal explicit IDs and invalid/conflicting explicit-ID behavior. Reserve IDs from all statically known current content elements; preserve legal targets instead of silently renaming them.
- [x] Record the spec's generated-anchor review baseline precisely: NFC, locale-independent lowercase, NFC again; preserve Unicode letters/numbers/marks and underscores; collapse whitespace/hyphen separators between retained content; remove other punctuation/symbols without transliteration; use `heading` for an empty base; allocate the first free base or numeric suffix in document order.
- [x] Include independently expected anchor examples for forward reservations, duplicate titles, existing suffixed IDs, Unicode/combining text, empty bases, and explicit conflicts. State that explicit IDs, not automatic duplicate allocation, provide insertion-independent external targets.
- [x] Record dynamic title/ID/spread limitations, requested-TOC-only warnings, no expression/component evaluation, and the fact that complete MDX Transform includes recma even when Emit is not requested.
- [x] Carry forward the complete normalized static source-text rules and exact excerpt/metadata value oracle from the earlier “Finalize the built-in projection contract” decision, including the full Latin Unicode Sets regex and frozen half-open CJK interval table. Do not treat transitional helpers as normative values.
- [x] Reconcile conflicting active content-architecture guidance and add explicit scoped supersession notices to relevant historical content decisions, preserving their reasoning and unrelated publication decisions. Preserve factory DI, the existing ambient host, distinct public/private views, and the eight-field public context.
- [x] Record the approved bounded migration: working new selections may temporarily coexist with existing callers on the implementation branch; Ticket 11 removes the legacy path completely. No compatibility aliases, unimplemented advertised methods, or intermediate 1.0 release are promised.
- [x] Leave the parent spec unchanged. Publish the concrete contract as a durable domain/API decision and ensure subsequent tickets can find its authority without depending on session-only notes.

## Scope and verification

This is the approved contract-preparation prerequisite, not a product implementation or a general redesign. Check terminology, contract consistency, normative value examples, scoped supersession, and documentation formatting. Do not claim production build/test or release verification from documentation work.

## Comments

### 2026-10-01 — implementation and lead acceptance

- Criteria 1–4: ADR 0002, Public API / Options / Identity and input sections define exact exports, real Zod input/output types, local-before-global options, explicit definition identity and native input/wrapper behavior.
- Criteria 5–9: ADR 0002, Navigation / Explicit IDs / Automatic Anchors sections define transformed flat navigation, full reservations, HTML ID legality, conflict failure, independently expected Unicode/suffix fixtures and static MDX limits/full recma.
- Criterion 10: ADR 0002, Source Analysis oracle reproduces the complete Latin `v` regex, all 29 half-open CJK intervals, exact excerpt truncation and weighted metadata arithmetic.
- Criteria 11–13: root guidance and three active knowledge documents point to ADR 0001/0002; 22 historical bodies are byte-identical beneath scoped notices. Bounded coexistence ends at Ticket 11. Parent spec, CONTEXT, ADR 0001 and original index are unchanged.
- Lead reran `node /tmp/opencode/velite-ticket01-contract-check.mjs`: 11 anchor bases, 10 allocation documents, 2 conflicts, 7 excerpts, 58 CJK boundaries and 64 local links passed. `pnpm exec prettier --check` on 27 changed docs and `git diff --check` passed.
- Independent Standards (`ses_f0a4eaeefffeN3RBjmkMcH8wpV`) and Spec (`ses_f0a4eaeb4ffeA6Zf94fQos9ydC`) reviews found no material issues. Lead inspected actual unstaged/new document changes. These are contract checks, not product/release verification.

### 2026-10-02 — acceptance checklist audit

- Criteria 1–4: `adr/0002-content-definition-and-anchor-contract.md:9`, `:89` and `:113` specify finite factories/types, option precedence, definition identity, exact input selection and native wrappers. Criteria 5–10: `:148`, `:158`, `:178` and `:227` specify actual navigation targets, explicit-ID conflicts, independent anchor examples and the complete source-value oracle.
- Criteria 11–13: active guidance points to ADR 0001/0002; `adr/0002-content-definition-and-anchor-contract.md:285` scopes supersession and bounded migration. Read-only comparisons reconfirmed all 22 historical changes are notice-only insertions and the parent spec is byte-identical to its original indexed version. These checks retain 13/13 documentation criteria, not product or Ticket 11 acceptance.
