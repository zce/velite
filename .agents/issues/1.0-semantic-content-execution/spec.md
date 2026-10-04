# Velite 1.0 — Semantic Content Executions

Status: ready-for-agent

Created: 2026-10-01

Architecture: ADR 0001, “Share semantic results of explicitly defined content executions”

Readiness: implementation-ready scope, not production verification or 1.0 release approval. Concrete interface baselines below must receive contract review before release; they are not retroactively approved export or anchor-value decisions.

## Problem Statement

Content authors need generated Markdown/MDX content, navigation, excerpts, and reading metadata to work together without learning Velite's parser ownership or schema scheduling machinery. Today, sharing pristine parses by inferred configuration equality and copying them into independent branches prioritizes an optimization over ordinary plugin semantics. Processor closures, mutable VFiles, legal tree/file replacements, and opaque plugin state cannot be reconstructed reliably by general copying.

A source outline is also not necessarily navigation through transformed content. Plugins can add, remove, rename, or retarget headings. Independently calculated title slugs can point nowhere or collide, while excerpts and reading metadata intentionally describe Source Content rather than those transformations.

Velite 1.0 can break the old API, but should not stabilize a hybrid schema interface, hidden sharing inference, or cloneability restrictions that create another migration later. The goal is a small, defensible public contract backed by strong ownership and lifecycle invariants, not a promise that no future requirement can ever change the design.

## Solution

Introduce explicit Content Definitions, separate from Zod schemas. Reuse one definition when generated content and related selections should describe the same selected input. Its finite methods produce ordinary Zod schemas for generated HTML or MDX code, Navigation TOC, source excerpt, and reading metadata.

Within one record validation, the same definition and exact selected input coordinate one exclusively owned content execution. That execution advances through Parse, complete Transform, and Emit only as requested. It shares detached semantic results, never a pristine AST or reconstructed plugin state.

Navigation follows statically determined transformed headings and their actual Heading Anchors. Source Analysis remains pre-transform even when requested after generation. Native Zod composition, ordinary plugin processing, controlled stage effects, and record/build transaction constraints remain intact.

## User Stories

1. As a content author, I want to choose Markdown or MDX explicitly, so that my source uses the appropriate syntax and processing semantics.
2. As a schema author, I want a Content Definition distinct from a result schema, so that configuration and data validation have clear roles.
3. As a schema author, I want finite result-schema factories, so that I can discover supported outputs without learning an extension protocol.
4. As a schema author, I want to reuse one definition for generated content and navigation, so that both describe one content execution.
5. As a schema author, I want separately created definitions to remain independent, so that equal-looking configuration does not silently share state.
6. As a schema author, I want different selected strings to remain independent even under one definition, so that separate documents are not accidentally combined.
7. As a schema author, I want an explicit string to override the file body, so that frontmatter or preprocessing can select the intended content.
8. As a schema author, I want absent input to select the file body, so that ordinary content collections remain convenient.
9. As a schema author, I want an explicit empty string to remain selected, so that fallback does not hide an input error.
10. As a content author, I want missing or exactly empty selected content to produce a field-local issue without parsing, so that absence is inexpensive and understandable.
11. As a content author, I want whitespace-only and non-empty content without static text to remain valid processing inputs, so that semantic emptiness is not confused with absence.
12. As a schema author, I want equal explicit and fallback text to use the same dialect-aware semantics, so that input selection does not change derived values.
13. As a schema author, I want each result schema to work without a generated-content sibling, so that projection-only collections remain supported.
14. As a schema author, I want normal Zod inference and composition, so that transforms, refinements, wrappers, unions, and custom schemas remain usable.
15. As a schema author, I want wrappers to retain native Zod behavior, so that Velite does not introduce a hidden scheduling language.
16. As a schema author, I want explicit preprocessing to express conditional body derivation, so that optional input policy is visible in my schema.
17. As a schema author, I want validation recovery without automatic plugin retries, so that fallback does not repeat work or side effects.
18. As a schema author, I want a consumer's DTO mutation to remain local, so that transforming one TOC or metadata value cannot corrupt another.
19. As a custom-schema author, I want to compose known result schemas as ordinary black boxes, so that extension does not require shared AST access.
20. As a content author, I want excerpts and metadata to describe pre-transform Source Content, so that processing plugins do not change editorial source analysis.
21. As a schema author, I want late source selections to remain available after generation, so that sibling ordering does not alter their meaning.
22. As a content author, I want static text extraction to exclude MDX code and attributes, so that reading metadata does not count implementation syntax.
23. As a content author, I want Unicode-aware excerpt and metadata rules, so that non-ASCII content has independently calculable values.
24. As a schema author, I want different excerpt lengths to share processing, so that formatting a result does not create another parser execution.
25. As a site author, I want navigation to follow added, removed, renamed, and retargeted headings, so that links match Build-time Content.
26. As a site author, I want flat navigation items with depth, title, and actual ID, so that my UI can build the desired outline without guessing targets.
27. As a site author, I want legal explicit IDs preserved, so that manually maintained external links remain stable.
28. As a site author, I want automatic IDs to avoid every statically known target in the content, so that headings do not collide with other elements.
29. As a site author, I want deterministic unique automatic IDs and explicit-ID conflict diagnostics, so that broken navigation is not silently published as valid content.
30. As an MDX author, I want eligible intrinsic static JSX headings included, so that literal HTML-style headings participate in navigation.
31. As an MDX author, I want dynamic heading limitations explained without evaluating expressions, so that compilation remains safe and navigation guarantees stay truthful.
32. As a component author, I want the heading-ID forwarding requirement documented, so that runtime components preserve generated navigation targets.
33. As a plugin author, I want one ordinary processor continuation, so that parser and transformer closures retain their intended state.
34. As a plugin author, I want legal replacement trees and VFiles followed, so that downstream processing sees the values I return.
35. As a plugin author, I want opaque private state left alone, so that Maps, functions, symbols, cycles, or host objects are not rejected merely because Velite cannot clone them.
36. As a plugin author, I want normal compiler/file and message handling preserved, so that splitting processing into stages does not lose diagnostics or updates.
37. As a schema author, I want concurrent requests to reuse pending and completed stages, so that requesting several outputs does not rerun plugins.
38. As a schema author, I want source-only requests to skip transformations and emission, so that lightweight analysis avoids expensive downstream work.
39. As a schema author, I want TOC-only requests to complete normal transformation but skip emission, so that navigation is trustworthy without unnecessary serialization or minification.
40. As an MDX author, I want TOC withheld when later recma processing fails, so that an intermediate snapshot is not mistaken for successful compilation processing.
41. As a schema author, I want successful lower-stage results to survive later-stage failure, so that recovered generation errors do not destroy valid source analysis.
42. As a schema author, I want dependent fields to receive their own validation issues, so that shared work does not erase useful field attribution.
43. As a schema author, I want invariant and lifecycle faults to remain thrown errors, so that a validation fallback cannot conceal an internal defect.
44. As a plugin author, I want failed-stage Velite effect declarations discarded, so that partial work cannot leak asset or uniqueness effects.
45. As a plugin author, I want successful-stage declarations eligible once per execution, so that multiple consumers do not duplicate effects or select a timing-dependent owner.
46. As a plugin author, I want captured context capabilities to follow the active stage, so that asynchronous work does not write into an obsolete journal.
47. As a collection author, I want invalid records to discard every sibling effect, so that failed validation cannot contribute committed build state.
48. As a build user, I want valid candidate effects to follow existing cross-record and build publication policy, so that content processing does not bypass transactional checks.
49. As a plugin author, I want the limits of rollback documented, so that I do not mistake direct external I/O for a Velite-controlled transaction.
50. As a build user, I want shared warnings independent of the first requesting field, so that object-key and completion order do not change diagnostics.
51. As a build user, I want capability warnings only for requested navigation, so that source-only or generated-content-only use does not receive irrelevant TOC warnings.
52. As a build user, I want truthful source attribution, so that transformed or explicitly selected text is not assigned fabricated original-file positions.
53. As a maintainer, I want recursive pending demands rejected, so that user extensions cannot deadlock an execution waiting on itself.
54. As a maintainer, I want terminal, idempotent record close and harmless late settlement, so that asynchronous work cannot resurrect closed state.
55. As a build user, I want records, independent builds, and actual revalidation attempts isolated, so that processor state never leaks across their lifetimes.
56. As a maintainer, I want content ownership hidden behind a deep internal module, so that callers do not depend on processors, seeds, phase cursors, or memo keys.
57. As a package consumer, I want public runtime exports and inferred/generated types to agree, so that the packaged API works beyond source-only tests.
58. As an upgrading user, I want one documented replacement API without compatibility families, so that migration does not leave two contradictory contracts.
59. As a maintainer, I want superseded documentation and test clauses reconciled deliberately, so that future agents do not implement the abandoned design.
60. As a maintainer, I want representative performance and retention evidence, so that semantic capture costs are visible before accepting the implementation.
61. As a maintainer, I want architecture approval distinguished from release verification, so that a small prototype does not become an unsupported compatibility claim.

## Implementation Decisions

### 1. Accepted architecture and concrete-interface baseline

- Follow ADR 0001: explicit Content Definitions, record-local exclusive executions, fixed demand levels, detached semantic delivery, and no general shared-AST protocol.
- The working public spelling is a `content` namespace with `markdown(options)` and `mdx(options)` definition factories. Markdown definitions expose `html()`, `toc()`, `excerpt(options?)`, and `metadata()`; MDX definitions expose `code()` and the same three analysis/navigation methods.
- These spellings were proposed, not separately ratified as permanent exports. Implement and review them as one coherent type/runtime/documentation contract. A material departure requires review rather than silently creating another API family.
- A definition is not a Zod schema. Every method returns an ordinary Zod schema with the supported Zod inference/composition behavior. Keep the extended `s` namespace for ordinary Zod and other built-ins; remove the superseded hybrid Markdown/MDX schema roots rather than preserve them as compatibility aliases.
- Processing and compilation configuration belongs to the definition. Only excerpt length is selection-specific. TOC and metadata have no selection options; do not revive `original`, upstream TOC options, or metadata tuning.
- Generated content is a string. Navigation is a flat array of items carrying `depth`, `title`, and `id`, not `slug`. Metadata carries `readingTime` and `wordCount`.
- Finalize concrete exported type names and generated-anchor value fixtures during implementation, before acceptance for 1.0. This is bounded interface work, not permission to reopen accepted ownership or introduce speculative extension points.

### 2. Definition identity, input selection, and configuration

- Sharing requires the same definition identity, exact selected string, and record-validation scope. Separate factory calls remain independent even with identical options. Aliasing an existing definition or its method retains that definition's identity.
- Do not infer sharing through structural option comparison, plugin identity, hashing, or a profile registry. Markdown and MDX do not share an execution merely because source text is equal.
- An explicit primitive string wins; absent schema input falls back to the current file body. Explicit `''` is never replaced by fallback. Non-string, non-absent input remains a normal schema input error.
- Missing or exactly empty selected text produces the non-fatal custom issue `The content is empty` at the requesting field and performs no content demand or processor work. Implementation placeholders are not successful public values. Whitespace-only text is processed normally.
- Resolve effective options once before the execution starts, from the definition and current configuration epoch. Preserve supported option defaults, precedence, and plugin ordering unless this spec explicitly changes them; avoid unrelated option expansion. Do not clone or freeze opaque plugin configuration/state to obtain equality.
- Canonical source identity comes from the record scope, not a subsequently mutated or replaced VFile path. VFile replacement may affect ordinary plugin behavior without redefining execution ownership.

### 3. Native Zod composition

- Do not override wrapper methods, inspect arbitrary wrapper graphs, or infer work from the eventual retained value. Actual received content requests drive demand.
- `.optional()` is not a zero-work promise or a selected-body-presence policy. Depending on the supported Zod schema shape, an inner transform can run even when an outer wrapper returns `undefined` or suppresses its issues.
- `.catch()` recovers ordinary Zod issues; it does not retry a rejected content stage or catch directly thrown invariant faults. A later wrapper discarding a result does not undo a successfully requested stage.
- Conditional derivation uses explicit ordinary input selection/preprocessing. Do not add a body-presence option without an unmet use case.
- Arbitrary custom schemas remain black boxes. They can compose known result schemas but gain no AST, VFile, broker, or projection-recipe access.

### 4. One deep record-scoped module

- One internal content module owns definition/input lookup, resolved options, dialect adapter selection, the current processor/tree/file, stage outcomes, semantic snapshots, effect journals, diagnostic handoff, and close.
- Callers request known semantic selections, not parser slots, seeds, branch materialization, clone policies, or stage cursors. Record validation creates and finalizes the module and closes it in its outer cleanup boundary.
- State/dependency/lifecycle-bearing modules use explicit factory DI at existing composition roots. Pure schema factories, semantic extraction, and value algorithms do not need artificial wrappers.
- Markdown and MDX adapters share orchestration and semantic contracts, not a mandatory parser or AST. Each adapter owns processor assembly and local dependency typing corrections.
- Preserve the existing process-owned ambient schema host, distinct public/private carriers, and eight-field public schema context. The host gains no content cache, Builder, execution, or journal ownership; `context()` gains no public content service.
- Do not add a content-stage Engine graph, content artifacts to the file model or session store, or process/cross-record caches. Existing outer validation memoization is separate from an actual validation attempt's execution lifetime.

### 5. Fixed demand levels and ordinary continuation

| Level     | Required work                                               | Semantic results            |
| --------- | ----------------------------------------------------------- | --------------------------- |
| Parse     | Configure/freeze, parse, capture pre-transform source facts | Source excerpt and metadata |
| Transform | Complete ordinary processor run, including MDX recma        | Navigation TOC              |
| Emit      | Serialize and perform configured minification               | Generated HTML or MDX code  |

- Each stage has one in-flight operation and memoizes success or rejection for the execution. Requests in any order reuse work. A later higher demand continues the same processor rather than rerunning lower phases.
- Source-only demand can execute plugin attachers during initialization, but not returned transformers, compiler serialization, or minification. TOC-only skips serialization/minification, not recma or MDX code-AST construction.
- Run is indivisible at the dependency's public API boundary. Do not implement arbitrary transform-prefix sharing or return navigation before the complete run succeeds.
- Follow the final tree and file supplied by callback-style processing, including intentional replacements. Preserve ordinary process-equivalent compiler/file handling, including `value`, `result`, and messages; awaiting a tree alone must not lose the final file.
- Maintain ordinary plugin closure and private-state ownership. Velite does not copy, recursively freeze, or reject state merely for being opaque. A replacing plugin remains responsible for its intentional private-state transfer.
- Never execute generated MDX JavaScript, expressions, or components to derive these results. Fix dependency type discrepancies locally without exposing unstable AST types as a consumer contract.
- Reject a recursive demand that would wait on its own current or ancestor pending execution/stage. This is a correctness guard, not a public dependency graph.

### 6. Bounded semantic snapshots and Source Analysis

- Before transformations can mutate or replace the source tree, capture normalized static source text sufficient for the finite excerpt/metadata selections. Do not retain a second AST or reconstruct arbitrary plugin state.
- Capture navigation while transformed content structure is available. Keep it provisional until complete Transform succeeds.
- Capture work may occur before a particular selection is requested. Laziness avoids unrequested expensive stages, not every traversal. Final excerpt truncation and metadata calculation need not be eager.
- Source text includes ordinary text, static inline-code text, and statically known text children nested in JSX, in source order. Exclude expressions, ESM, element/component names, attributes, comments, and runtime evaluation. Join fragments with one ASCII space, collapse whitespace runs to one ASCII space, and trim both ends.
- Preserve the independently specified 1.0 excerpt and metadata value oracles from the earlier “Finalize the built-in projection contract” decision. Its obsolete pristine-sharing and source-TOC clauses do not survive.
- Excerpt defaults to 260 Unicode code points. Explicit length must be a non-negative safe-integer primitive number; invalid configuration synchronously throws `TypeError`. If truncation is necessary, keep the first requested code points, trim trailing whitespace, and append one `U+2026` outside the requested length. Do not split a valid surrogate pair; grapheme-cluster splitting remains permitted.
- Metadata consumes all normalized source text, not a truncated excerpt. Count Latin-script letter runs with combining marks and internal ASCII/curly apostrophe connectors using the established Unicode Sets oracle; count code points in the frozen half-open CJK intervals. Weighted word count is the Latin count plus CJK count multiplied by 0.56, without rounding. For reading time, divide that weighted count by 265, apply ECMAScript `Math.round`, and clamp the result to a minimum of one.
- Do not use the transitional current helper, raw source, or pre-1.0 file getters as the value oracle. A non-empty source without visible text yields excerpt `''` and metadata with reading time 1 and word count 0.

### 7. Transformed navigation and Heading Anchors

- Run controlled anchor assignment and navigation capture after user remark/rehype content transformations, at the dialect's content-tree point. For MDX this belongs at the end of the configured content-phase plugins, before conversion to the JavaScript representation, not after processor construction as a late code-phase plugin.
- Navigation describes eligible statically determined headings in transformed document order, including supported intrinsic HTML/JSX `h1`–`h6` headings. Items carry their actual output anchor IDs, not independently calculated slugs.
- Reserve statically known explicit IDs from all current content elements before allocating automatic heading IDs. Preserve legal explicit IDs, assign missing IDs deterministically in document order, and avoid all reserved/generated targets. Conflicting explicit IDs are content diagnostics, not silently renamed targets.
- The concrete generated-value review baseline is the previously suggested Unicode title base: NFC, locale-independent lowercase, NFC again; retain Unicode letters/numbers/marks and `_`; collapse whitespace/hyphen separator runs between retained content; remove other symbols/punctuation without transliteration. Use `heading` if the base is empty, then the first free base, base-1, base-2, and so on. This is a proposed value contract, not a claim that the prior empty/equal-slug oracle remains valid or that this exact candidate was separately approved.
- The final value contract must state explicit-ID validity, duplicate allocation, Unicode and empty-base examples, and stability limitations. Explicit IDs are the supported way to decouple external links from insertion of duplicate headings.
- When a recognized heading's title or target cannot be statically determined, omit it from Navigation TOC, preserve dynamic attributes, and provide a capability-limitation warning only when TOC is requested. Do not overwrite dynamic IDs or infer arbitrary spread values.
- Unknown components are not assumed to be headings. Do not evaluate runtime expressions, infer arbitrary component behavior, or reverse-analyze generated JavaScript.
- Later code-level plugins must preserve the captured heading/anchor semantics. Runtime heading components must forward IDs. These limitations must be documented; the guarantee does not cover surrounding layouts, visibility, or arbitrary runtime DOM.
- Automatic anchors are part of transformed content processing, not a side effect conditional on which TOC field happens to request first.

### 8. Stage failures, recovery, and diagnostics

| Failure                    | Dependent selections affected    | Earlier successful values retained |
| -------------------------- | -------------------------------- | ---------------------------------- |
| Parse                      | All selections of that execution | None from that failed stage        |
| Complete Transform         | Navigation and generated content | Source Analysis                    |
| Serialization/minification | Generated content                | Source Analysis and navigation     |

- Retain rejection; do not automatically retry within the same execution. A new actual validation attempt gets fresh execution state. Unhandled required-field failure invalidates the record; ordinary Zod recovery remains effective.
- Convert ordinary content/plugin validation failures into issues for the requesting schemas, without a hidden duplicate fatal error that defeats `.catch()`. Internal invariant and lifecycle faults remain thrown faults.
- Shared warnings belong to the record/content execution rather than the first consumer. Consumer field issues retain their normal paths. Demand-specific limitations reflect capabilities actually requested, including late TOC requests after a completed Transform.
- Reconcile messages and normal file mutations/replacements at stage finalization. Repeated consumers must not duplicate shared warnings. Do not fabricate original-source coordinates when selected/transformed text has no established mapping.
- Preserve the existing necessary diagnostic/publication boundary; this work does not redefine the complete diagnostic value model or prepare-hook protocol.

### 9. Controlled stage effects and record transactions

- Buffer Velite-owned effect declarations by the active controlled stage. Failed-stage declarations are discarded; successful-stage declarations become eligible once per execution, not once per selection or first-arriving field.
- Eligibility is not commitment. An invalid record discards all sibling effects. A valid candidate still passes existing cross-record validation and build publication policy before commitment.
- A successful lower-stage effect remains eligible if a later failure is recovered and the record remains valid. A failed stage's effects remain discarded even when its result is replaced by a fallback.
- Public capability closures captured during initialization must resolve the active execution/stage scope at invocation, including asynchronous transformer callbacks. Do not permanently bind them to the Parse journal or use a mutable process-wide current-stage pointer.
- Preserve isolation across simultaneous executions and records. Late declarations after stage finalization or record close cannot reopen journals or promote effects.
- Direct plugin filesystem/network/other external I/O is not rollbackable. TOC-only processing can perform transformation I/O and asset resolution. Do not promise zero I/O merely because Emit was not requested.

### 10. Delivery and terminal lifetime

- Deliver fresh detached arrays/objects for each public result delivery, including nested navigation items and metadata objects. Mutating one consumer's value must not affect another delivery or the internal snapshot. Primitive strings need no artificial wrapper.
- Internal snapshots remain encapsulated. Do not impose recursive freezing on plugin-owned values to achieve consumer isolation.
- Stage memoization retains completion and semantic outcomes, not obsolete raw trees/files as fulfilled promise values. Keep only the current owned continuation needed for a later stage and bounded snapshots; release superseded phase references.
- Close is terminal and idempotent. After close, pending settlement cannot start another stage, promote declarations, or repopulate retained state. Release module-owned references without claiming to revoke references independently retained by plugins.
- A definition may outlive records; its execution state may not. Revalidation, configuration replacement, and independent builds must not reuse a previous record's processor/tree/file.

### 11. Deliberate migration, not compatibility scaffolding

- Replace obsolete pristine artifacts, VFile seed copying, structural profile equivalence, transform branch materialization, and cloneability-based plugin restrictions wherever this content work uses them. Do not keep a second internal path “for compatibility.”
- Migrate public examples, documentation, generated-type assumptions, and API tests to one definition-plus-result-schema interface. Explain explicit reuse, native wrappers, source-versus-navigation semantics, ID forwarding, dynamic heading limitations, failure dependencies, and TOC-only I/O.
- Reconcile active content-specific architecture guidance and historical tracker clauses before source implementation proceeds. Mark superseded content decisions explicitly and link their replacement; preserve historical reasoning and unrelated build/publication decisions.
- Inherited excerpt/metadata value rules and necessary record/build transaction obligations remain valid unless explicitly superseded. Do not import unrelated broad release work as a prerequisite.

## Testing Decisions

### Confirmed seams

The user confirmed these existing boundaries on 2026-10-01:

1. **Primary seam: packaged public `build` / durable `Builder`.** Use isolated consumer fixtures and assert generated data/declarations, actual anchors, diagnostics, assets, and observable plugin calls. Configuration loading must use the same package entry consumers receive.
2. **Narrow supplementary seam: existing Builder composition and record-validation interfaces.** Use the current memory filesystem/runtime ports and schema-context harness for controlled effects, recursive demands, close, and late settlement that cannot be reliably exercised through filesystem fixtures alone.
3. **Type/export contract seam: existing API and packaged TypeScript consumer tests.** Verify ordinary Zod input/output inference and absence of internal content machinery.

No new public testing API, cache inspection method, processor registry, statistics service, or generic instrumentation framework is required. Use the highest seam that can prove the behavior; do not repeat the same contract at every internal layer.

### Behavioral coverage

| Area                     | Required observations                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition identity      | Same definition/input shares observable work; equal-looking separate definitions and different inputs do not; aliasing retains identity.                                                                        |
| Selection                | Explicit/fallback equality, explicit empty override, missing body, invalid input type, whitespace-only and no-visible-text distinctions; empty input starts no processor.                                       |
| Demand                   | Source-only runs initialization/parse but no transformers/compiler/minifier; TOC runs complete transformation but no serialization/minification; late primary output resumes without replay.                    |
| Ordering/concurrency     | Controlled overlapping requests and reversed field order yield equivalent values, effects, and diagnostics; one normal invocation per requested stage.                                                          |
| Source snapshots         | Mutating/removing/replacing the source tree during Transform does not change a later excerpt or metadata selection. Multiple excerpt lengths do not create new executions.                                      |
| Source value oracles     | Static JSX children, inline code, expressions, ESM, attributes, comments, whitespace; independent Unicode excerpt and complete metadata calculations, not current helper equivalence.                           |
| Navigation               | Plugins add/remove/rename/reorder headings or set targets; HTML and MDX output retain the captured IDs; intrinsic static JSX headings participate.                                                              |
| Anchor allocation        | All-element explicit reservations, forward reservations, duplicate titles, suffix collisions, empty bases, Unicode, and explicit conflicts. Exact expected values follow the reviewed concrete contract.        |
| Dynamic limits           | Dynamic title/ID/spread cases preserve compilation and values without evaluation; TOC-only limitation warnings, including a late TOC request; unknown components are not invented headings.                     |
| Plugin continuation      | Stateful parser/transformer closure, ordinary processor data, Map/function/Symbol/WeakMap or cyclic private values, asynchronous callbacks, legal tree/file replacement and intentional private-state transfer. |
| Compiler/file contract   | Final replacement file reaches downstream work; compiler changes to value/result/messages and shared warnings are genuinely asserted, not placeholder success assertions.                                       |
| Full MDX run             | A late recma rejection after navigation capture prevents successful TOC, retains Source Analysis, and is not retried. Exercise the dependency's real processing chain.                                          |
| Failure dependencies     | Parse affects all; Transform affects TOC/output; serialization/minification affects output only. Concurrent and repeated requests retain the same rejection without duplicate work.                             |
| Zod composition          | Transforms/refinements, supported wrapper/union composition, `.optional()`, `.catch()`, explicit preprocessing, and async use follow supported Zod semantics. Directly thrown invariant errors escape fallback. |
| Detached results         | One consumer mutates arrays, navigation item objects, or metadata; other concurrent and subsequent deliveries remain unchanged.                                                                                 |
| Stage effects            | Attacher-captured capability emits into the current stage; failure discards only that stage; success promotes once; recovered higher-stage failure preserves eligible lower-stage effects.                      |
| Record/build transaction | Invalid sibling discards all record effects; valid candidates still follow cross-record/build policy; TOC-only asset work is accounted for without duplicate declarations.                                      |
| Diagnostics              | Each requesting field retains its issue path; shared warnings do not choose a first consumer; message mutation/replacement is handled; unmapped selected text has no invented original-source coordinates.      |
| Recursive/lifecycle      | Recursive pending demands fail rather than hang; repeated close is safe; pending settlement and late captured-capability calls cannot start stages or revive/promote closed state.                              |
| Isolation                | Different records and independent builds, fresh actual revalidation, and configuration replacement cannot share processor state. Preserve legitimate outer validation memoization behavior.                     |
| Package/types            | Runtime and built declarations expose the agreed definition API and ordinary Zod outputs; generated collection types are correct; legacy hybrid roots and internal machinery are absent.                        |
| Performance/retention    | Representative Markdown/MDX builds, primary-only, source-only, TOC-only, combined selections, repeated records, and rebuilds quantify setup/capture costs and bounded record ownership.                         |

### Test quality and prior art

- Reuse `node:test` and `node:assert`. Existing packaged integration tests already exercise config self-reference, data/assets, and generated declarations; existing Builder tests use memory runtime capabilities; API/dist consumer tests already exercise export maps and TypeScript resolution.
- Ordinary plugins can record parser/transformer/compiler calls and final tree/file observations. Use controlled promises/barriers for concurrency and failure order, not sleeps or timing-dependent assertions.
- Tests should assert observable values, issue/warning attribution, stage invocation behavior, controlled declarations, and lifetime outcomes. Do not lock in slot counts, clone layouts, seed representations, or private memo object structure.
- Replace obsolete source-only TOC/no-transform, matching-profile coalescing, branch-copy, and unsupported-seed test expectations. Preserve relevant existing regressions rather than deleting coverage wholesale.
- The source excerpt and metadata oracle remains independently calculable from the earlier normative decision. For navigation, compare the expected reviewed value contract and actual transformed targets, not the obsolete source-slug helper. Runtime expression/component execution is not needed for this oracle.
- The prototype is supporting evidence, not a test oracle or production template. In particular, do not copy its raw-artifact promise retention or mutable memoized DTO delivery.
- Review ownership/release paths directly and use deterministic late-settlement/isolation tests; supplement with representative process measurements. Do not make garbage-collection timing or a fabricated performance percentage the correctness gate.
- For implementation acceptance, run `pnpm build` followed by `pnpm test`. The current test command itself builds first; source-level tests remain supplementary to packaged-entry and consumer-type coverage. Record dependency/runtime versions and any performance or memory regression with its explanation before acceptance.

## Out of Scope

- General custom projections, recipe protocols, public pristine AST/VFile/processor access, cache controls, adapter registries, or a dependency DAG.
- Structural configuration deduplication, mandatory Markdown/MDX common parsing, cross-record/process content pools, arbitrary transform-prefix sharing, or opaque-state cloning frameworks.
- Evaluating MDX JavaScript/components, reconstructing navigation from arbitrary generated code, inferring surrounding page DOM, or guaranteeing arbitrary third-party plugins are globally concurrency-safe.
- Compatibility aliases for hybrid roots, inferred-dialect standalone projections, `original` TOC behavior, metadata tuning, or speculative body-presence options.
- A separate rendered-content excerpt/metadata family, a source-outline API, or additional analysis methods without an evidenced requirement.
- Rewriting unrelated Builder coordination, generation/publication, cleanup/recovery, diagnostic normalization, or prepare-hook protocols. Existing necessary transaction constraints still apply.
- Adopting the older broad release-gate/evidence infrastructure, building a new benchmark dashboard, or creating a migration CLI/codemod product as part of this content module.
- Source implementation, dependency updates, implementation-ticket decomposition, git commits, or external issue publication in the act of publishing this spec.

## Further Notes

### Authority and inherited contracts

- Domain vocabulary: `CONTEXT.md`.
- Accepted architecture: `adr/0001-share-semantic-content-results.md`.
- Full conversation consensus and remaining verification: `.agents/sessions/20260930-1956-content-architecture-reconsideration/architecture.md`.
- Inherited **source-text, excerpt, and metadata value rules only**: `.agents/issues/1.0-content-derivation-kernel/issues/20-finalize-the-built-in-projection-contract.md`, specifically “Static visible text,” “Excerpt,” and “Metadata.” Its complete Unicode Sets regex and frozen interval table are normative inputs to implementation and independent tests. Its source-only TOC, empty/equal slugs, root API, profile identity, no-text-snapshot assumptions, and branch/effect statements are superseded where they conflict with this spec and ADR 0001.
- The older map at `.agents/issues/1.0-content-derivation-kernel/map.md` and its content-sharing/API/migration/performance clauses need explicit scoped reconciliation during implementation. Unrelated publication decisions are neither approved anew nor superseded by this spec.
- Current guidance at `.agents/knowledge/module-architecture.md` describes the implemented broker/seed architecture; its general factory DI and ambient-host rules remain, while conflicting content-specific target clauses require updating before source changes.

### Evidence and acceptance limits

- A small real-dependency experiment used Unified 11.0.5, MDX 3.1.1, and Terser under Node v26.10.0. It supported fixed-stage continuation, concurrent reuse, late source snapshot access, callback replacement, and withholding navigation after late recma failure.
- Local Zod 4.4.3 probes demonstrated why native wrapper behavior must not be interpreted as a content scheduling contract. Version-specific probe outcomes are evidence, not a permanent promise across unsupported Zod versions.
- Production effect scopes, diagnostics, full static-text/heading values, consumer detachment, recursive guards, close/late settlement, and representative performance/retention were not established by that prototype. They remain implementation acceptance obligations above.
- Before 1.0 acceptance, review the concrete export/type surface and exact anchor values, reconcile superseded contracts, and retain evidence for the changed behavior. Architecture consensus and `ready-for-agent` do not imply release approval or a universal plugin-compatibility guarantee.

### Publication scope

This is a new durable feature spec rather than an in-place rewrite of historical tickets. Publishing it changes documentation only; implementation and ticket decomposition are separate follow-up work.
