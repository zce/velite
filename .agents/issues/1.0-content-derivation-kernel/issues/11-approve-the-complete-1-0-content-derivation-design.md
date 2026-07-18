# Approve the complete 1.0 content derivation design

Status: resolved
Origin: #398 (deleted from GitHub)
Created: 2026-07-15T12:06:57Z
Type: grilling
Blocked by: 18, 20, 21, 22, 23, 24, 25

---

## Question

Does the synthesized 1.0 content derivation design fully resolve the public contract, internal boundaries, plugin and extension semantics, effects and failures, cache behavior, migration impact, and measurable acceptance criteria well enough to hand off for implementation planning?

## Review

The 2026-07-18 final review did not approve the design for implementation planning. The selected core direction is coherent, but the review found unresolved choices in the public projection surface, schema-run storage ownership, parse/VFile compatibility, effect provenance, diagnostic and publication transactions, pipeline-epoch lifecycle, and executable performance baselines. Tickets 20-25 capture those blockers. Migration guidance and the VFile bug disposition were reopened where the blockers invalidate their prior implementation guidance.

Human review material is in `.agents/sessions/20260718-0948-final-design-review/`.

## Reapproval blockers

The 2026-07-18 reapproval review found four remaining hard blockers and did not approve the design:

- Ticket 20 does not yet define a complete excerpt truncation, TOC slug, or metadata token/range oracle.
- Ticket 23 leaves the public immutable diagnostic field model and parts of its normalization representation to a later final model.
- Ticket 24 does not yet reconcile cleanup diagnostics with immutable `BuildResult` construction, define reader-safe retirement, or state the publication authority of operations admitted before Builder disposal.
- Tickets 18 and 25 require post-implementation artifacts from this pre-implementation design approval; they must distinguish approval of an executable evidence contract from later implementation/release acceptance evidence.

Tickets 20, 23, 24, 18, and 25 were reopened for those narrow decisions. Ticket 11 remains claimed and blocked; no `## Answer` is recorded until they are resolved and the complete design is reviewed again.

## Answer

### Final approval scope

The complete Velite 1.0 content derivation design is approved for implementation planning. This is a final pre-implementation design reapproval across Tickets 03-10, 18-25, including their explicit supersessions. It approves the public contract, private seams, ownership and lifecycle model, migration contract, and executable acceptance-evidence contract. It does not perform implementation planning, create implementation tickets, slice work, implement the design, or constitute implementation or release acceptance.

### Public contract completeness

The public schema contract is complete and leaves no implementation-time public behavior choice:

- Direct `s.markdown(options)` and `s.mdx(options)` returns are immutable dialect/profile roots and ordinary schemas. Each exposes exactly `toc()`, `excerpt(options?)`, and `metadata()` as the finite built-in projection family. Ordinary Zod wrappers need not preserve those methods.
- Top-level `s.toc`, `s.excerpt`, and `s.metadata`, `TocOptions`, `original`, `.project()`, a generic projection protocol, public content capability, public AST/VFile access, and the root `createBuilder` export are absent with no compatibility getter, proxy, shim, or subpath.
- Every root and sibling independently selects `explicit string input ?? ContentFile.content`; explicit `''` wins and, like a missing fallback, produces the field-local `The content is empty` issue with zero content-capability or parse work. Whitespace-only and non-empty no-visible-text inputs retain their specified successful semantics.
- Excerpt uses the exact default-260, non-negative-safe-integer, Unicode-code-point, `trimEnd()` plus one `U+2026` truncation oracle. TOC uses the exact Velite-owned NFC/Unicode-category slug oracle, retains empty slugs, and leaves duplicate slugs equal and unsuffixed. Metadata uses the exact Unicode Sets `v` regex, frozen half-open CJK ranges, code-point iteration, `0.56`, `265`, and ECMAScript rounding oracle.
- `Diagnostic` is the sole exported normalized diagnostic model, with required stage, origin, and provenance and the complete `DiagnosticValue` tagged domain. `SchemaContext.collectEffect(effect, context)`, `EffectDeclarationContext`, `StableOccurrence`, the immutable prepare context, the sole `addDiagnostic()` sink, durable strict policy, removed `BuildOptions.signal`, and immutable `BuildResult.operationalDiagnostics` have complete public semantics.

Unsupported calls outside the declared TypeScript interfaces do not become compatibility promises merely because untyped JavaScript can express them. This does not leave any supported public behavior for implementation to choose.

### Internal seams and ownership completeness

The selected modules are deep and their dependencies and lifetimes are explicit:

- One process-wide `SchemaContextHost` owned by default process composition only propagates active leased schema runs. It owns no Builder, epoch, broker, generation, reader, publication, cleanup, cache, registry, or lifecycle state.
- Internal Builders receive a narrow `SchemaRunner`. Public and private schema views are distinct runtime objects; the exported `context()` returns only the eight-field public view, while Velite-owned roots use one private leased record-bound content capability.
- Each pipeline epoch owns configuration, schemas, engine, `SessionStore`, broker factory, profile namespace, and any real processor pool or lock. Each record validation owns one broker and effect transaction; each branch owns its mutable tree, VFile, messages, diagnostics, effects, and outcome.
- One Builder-local generation-publication module is the sole owner of current committed generation truth, recovered publication state, publication terms and fences, staging transactions, protected manifests, reader pins, and cleanup backlog. Parallel Builders share none of this mutable state.

No IoC container, service locator, process-wide coordination registry, public transaction manager, or second incremental cache is introduced.

### Plugin, custom-schema, parse-sharing, and VFile completeness

Ordinary Unified, remark, rehype, recma, and MDX plugin semantics remain supported. Global registrations precede root-local registrations within each phase, preserving order and duplicates. Matching selected text, source path/origin, dialect, and exact effective parse profile coalesce one record-scoped pristine parse; rejected matching parses are retained only through record disposal. Root identity, hash identity alone, completion order, and sibling order are never sharing identity.

Parser participants must be deterministic and reentrant for a fixed profile. There is no public or internal no-share marker, hidden-state probe, retry-as-unshared behavior, or stateful-plugin compatibility promise. Returned transformers do not run for static TOC, excerpt, or metadata projections; each transforming demand executes its requested phases on isolated branch state.

The shared parse captures an internal immutable VFile seed containing only the supported `cwd`, ordered `history`, data graph, and parse-message graph. Every transforming branch receives an independent tree and fresh VFile materialized from that seed, and the same branch VFile continues through all phases in that branch. No parse VFile identity crosses into every branch, and unsupported seed state fails deterministically rather than being shared, omitted, or used to disable sharing.

Custom schemas remain ordinary black-box Zod schemas. They own any parser, AST, VFile, cache, I/O, mutable closure state, and external side effects they create. They receive no broker, pristine representation, request constructor, generic demand, projection protocol, or private branch state.

### Effect, diagnostic, and prepare completeness

Effects are owner- and provenance-bearing declarative facts promoted through branch, valid-record, cross-file-valid, and committed-generation transactions. Custom declarations provide a record-rooted semantic path, stable declaration ordinal, and one validated stable occurrence; Velite supplies system owner/source provenance. Call order, append order, visitation counters, cache hits, Promise completion, and object identity are forbidden identity and ordering sources.

An invalid record discards every sibling effect. Uniqueness conflicts invalidate every participant simultaneously and discard every participant's complete effect set. Exact duplicates alone collapse under complete normalized identity and canonical order.

Before `prepare`, core diagnostics are normalized, detached, canonicalized, and recursively made immutable according to the complete exported `Diagnostic` and `DiagnosticValue` oracle. The hook receives that exact immutable snapshot and only `addDiagnostic(PrepareDiagnosticInput)`. It cannot mutate, replace, delete, reorder, downgrade, or impersonate core diagnostics. Hook input is synchronously validated and snapshotted; duplicate and key-conflict behavior, throw/rejection behavior, sink closure, and late-call behavior are deterministic. `PrepareResult.diagnostics` remains removed.

Fatal and strict policy runs only after prepare diagnostic finalization and before staging. `prepare(false)` records empty-publication intent and bypasses no diagnostic, strict, staging, or publication gate.

### Generation, publication, reader, watch, and lifecycle completeness

Full builds and owner patches construct the same complete immutable generation candidate and pass through the same staging and sole commit seam. Atomic replacement of the configured current pointer is the external commit linearization point. Without an intervening `await`, the publication critical section then installs the committed in-memory generation and, for reload, the active epoch tuple, publication term, watermark, and old-epoch draining transition.

After commitment, the operation snapshots one finite canonical cleanup plan, awaits exactly one first attempt until every selected item has a terminal `deleted`, `absent`, `failed`, `timeout`, or `partially-deleted` outcome, creates a fresh immutable `operationalDiagnostics` snapshot, and only then constructs and returns a detached immutable `BuildResult`. Cleanup, logger, reporting, result-construction, or evidence-retention failure cannot reclassify confirmed commitment. Later retries never mutate an earlier result.

Managed readers use private Builder-local leases that pin validated persisted publications and referenced blobs. External readers receive the exact current-plus-direct-predecessor generation-count window and must reacquire before a second successful pointer advance. Retirement uses the complete current, predecessor, and live-pinned protected-manifest set plus validated committed transition or backlog authority. It never infers ownership from wall-clock grace, opened handles, directory enumeration, discovery history, or file presence.

Cold recovery reads only the configured pointer and sealed current/predecessor/backlog metadata. Corrupt or unverifiable ownership authorizes no publication or deletion; unknown residue remains for explicit clean.

Watch establishes event coverage before snapshot, uses a Builder-owned journal and watermarks, warms and catches up a shadow epoch, and swaps it only through successful generation publication. Epoch supersession revokes old-epoch publication authority while admitted old work drains. Builder admission is separately linearized: an operation admitted before `dispose()` retains ordinary publication authority while disposal waits, whereas post-disposal admission is rejected. Builder disposal is awaitable, idempotent, terminal, and may remain pending for a never-settling plugin, non-terminal adapter operation, or unreleased managed-reader lease.

### Migration completeness

The stable BC-01 through BC-31 inventory completely covers public types and runtime behavior, projection values, custom schemas, plugin order and responsibility, VFile continuity, effects, diagnostics, prepare, strict policy, publication layout, content-addressed assets, recovery, readers, watch/reload, admission/disposal, cancellation removal, and the harness-only revision adapter. Each item has an exact before/after consequence, one Auto/Detect/Manual classification, safe positive and negative automation boundaries, artifact kinds, accountable acceptance owners, production phases, independent oracles, and failure conditions.

Migration provides no compatibility shim, dialect guesser, product revision adapter, old derived `ContentFile` field, public debug interface, or non-atomic ordinary-directory conversion. Auto rewriting is limited to syntax-proven direct-sibling cases; ambiguous, orphan, wrapped, named-root, dynamic, plugin-bearing, or otherwise unproven forms remain Detect or Manual.

### Pre-implementation performance evidence-contract completeness

The design approval evidence contract is complete and executable before implementation. It fixes:

- protocol, artifact-manifest, retained-field, gate-registry, workload, fixture, structural-event, raw-measurement, derived-report, and independent-verdict schemas;
- baseline commit `3903ba3bdcfe9ce987f69f2de799d218a939c677`, its immutable qualification/replacement procedure, first-kernel versus accepted-release comparison policy, and the one-time 30% overhead-reduction gate;
- the isolated A/B/C dependency bridge and the strictly harness-only revision adapter;
- pinned host policy, Node and pnpm versions, paired AB/BA runs, timed regions, RSS sampling, validity and one-rerun rules;
- exact median, MAD, sample-CV, nearest-rank p95, paired-ratio, no-op/incremental delta, static-overhead, RSS, and affine-growth formulas;
- Markdown and MDX primary, combined, projection-only, plugin/asset, mixed, stress, identity, concurrency, rejection, failure, publication, reader, recovery, watch, disposal, and parallel-Builder workloads;
- every hard gate's typed inputs, owner, phase, formula or independent oracle, pass/fail/invalid classification, rerun eligibility, retained outputs, negative surfaces, and failure conditions; and
- a bundle-only independent recalculation contract that requires no private object identity, live Builder, mutable registry, Promise completion order, directory enumeration, best-effort filesystem behavior, or candidate-private helper.

Candidate correctness uses the final independent 1.0 projection, diagnostic, effect, publication, reader, and lifecycle oracles rather than pre-1.0 output. Wall clock is only a numeric protocol input and never a structural or lifecycle oracle.

### Post-implementation artifact obligations

This approval does not waive any post-implementation obligation. Implementation and release acceptance still require the actual migrated documentation and examples, ast-grep recipes and fixtures, public and built declarations, built distributions, package/export/reflection reports, semantic and negative tests, independent excerpt/slug/metadata and diagnostic calculators, effect/prepare traces, publication/cleanup/reader/recovery/watch/disposal traces, structural event and retention reports, host and dependency qualification, A/B/C builds, raw timing and RSS samples, complete evidence bundles, derived reports, and independently recalculated verdicts.

A missing, malformed, contradictory, non-recalculable, or hard-gate-failing artifact remains an implementation or release failure. This design approval is not release acceptance and grants no waiver authority.

### Private and public negative surface

The supported public surface exposes none of the content broker, parse slot, request constructor, pristine artifact, AST, VFile seed, branch materializer, private capability, host installer, runner, carrier, lease, effect or diagnostic transaction, normalizer/comparator implementation, mutable collector, registry, generation or publication identity, ownership manifest, reader lease, cleanup handle, fence, epoch, journal, watermark, lifecycle token, instrumentation sink, counter registry, raw event stream, or statistics service. These are absent from root declarations, runtime exports, export maps, public contexts, and reflection-visible public objects.

Only root-package supported imports are compatibility surface. Harness adapters, logical labels, calculators, reports, and aggregation remain acceptance infrastructure, not product or migration interfaces.

### Remaining implementation freedoms

The remaining freedoms are genuinely internal and non-semantic: module and type names; broker index and collision-safe hashing structures; AST isolation by clone, ownership transfer, copy-on-write, or persistent representation; VFile seed copy/freeze representation; processor construction, freeze timing, pooling, locking, or serialization where ordinary plugin semantics remain intact; branch scheduling; canonicalization algorithms that produce the specified order; immutable snapshot implementation; platform-specific atomic-pointer adapter; optional validated trash rename; persisted encoding details that satisfy the sealed schema; and private write-only instrumentation transport.

No hypothetical processor pool or lock seam is required when no real implementation needs one. None of these freedoms may alter public values, diagnostics, effects, ordering, sharing identity, lifecycle authority, publication truth, retention rules, acceptance evidence, or negative surfaces.

### Pass/fail rationale and contradiction result

The design passes because every supported public behavior, capability seam, ownership boundary, transaction, publication and lifecycle transition, migration consequence, acceptance formula, evidence phase, independent oracle, negative surface, and hard failure condition required for implementation handoff is defined and mutually consistent. The current product implementation was used only to understand migration from the present state; it was not treated as the final 1.0 oracle.

No new cross-ticket hard contradiction was found. The final clauses preserve Tickets 03-10 and 19 while Tickets 20-25 and 18 explicitly refine or supersede their identified ambiguities. The process-wide host owns no Builder or epoch state; custom schemas receive no private content state; structural oracles use logical values and persisted metadata rather than forbidden identity or race observations; and the evidence contract no longer requires implementation artifacts before implementation.

### Superseded reapproval blockers

All prior Ticket 11 blockers are superseded:

- Ticket 20 now supplies complete excerpt, TOC slug, duplicate-slug, and metadata oracles.
- Ticket 23 now supplies the complete exported `Diagnostic` and `DiagnosticValue` model, recursive normalization and immutability, effect transaction seam, and sole prepare sink.
- Ticket 24 now fixes pointer commit, synchronous install, awaited first cleanup, immutable result timing, reader-safe retirement, recovery, and pre-disposal admission authority.
- Tickets 18 and 25 now separate design-approval evidence contracts from mandatory post-implementation artifacts and verdicts.
- Tickets 21 and 22 fix process-host ownership, Builder isolation, immutable VFile seed continuity, parser responsibility, and the absence of a no-share marker.

The complete design is therefore approved for handoff to a later implementation-planning flow. This ticket does not perform that planning.

## Final reapproval after concept convergence

### Authority and verdict

This section is the current and complete Ticket 11 answer. The earlier approval text remains decision history only and is superseded wherever it conflicts with this section or the final concept-convergence resolutions in Tickets 18, 23, 24, and 25.

The review covered the effective non-superseded contracts in Tickets 03-10 and 18-25, the authoritative map, and the concrete acceptance artifacts linked by Ticket 25. Current product implementation was not used as the final design oracle.

**The Velite 1.0 shared content derivation kernel is reapproved for implementation planning with no known design blocker.**

This is approval for a later implementation-planning handoff only. It does not create implementation tickets, slice implementation work, choose implementation representations, implement product code, or constitute implementation or release acceptance.

### Minimal kernel

The complete design requires no more than these 12 semantic concepts. They do not imply 12 classes, factories, files, or independently testable object identities.

1. **Derivation family:** Content Input selection, one Markdown/MDX dialect-profile root, and exactly three finite sibling projections.
2. **Record content derivation:** exact record-local parse sharing and isolated demand execution.
3. **Leased schema execution:** one state-poor process host, distinct public/private views, and capabilities that reject use after run settlement.
4. **Effect transaction:** declarative effects promoted only from valid records and cross-file-valid candidates.
5. **Diagnostic finalization:** complete detached immutable diagnostics plus the sole append-only prepare channel.
6. **Pipeline epoch:** one resolved configuration and its schemas, engine, store, adapters, and real resources.
7. **BuilderCoordinator:** operation admission, watch replay, epoch activation/supersession, current logical and physical truth, publication authorization, and disposal.
8. **Generation:** complete immutable candidate and committed logical snapshots.
9. **Publication:** immutable physical projection, atomic current pointer, manifests, and cold recovery.
10. **Retirement:** current/predecessor protection, one finite first cleanup attempt, and persistent retry authority.
11. **Migration contract:** action-level user consequences, safe automation boundaries, and independent migration oracles.
12. **Acceptance protocol:** fixed baseline and A/B/C attribution, content-addressed raw evidence, formulas, cross-checked structural oracles, and an external independent verdict.

### Complete public contract

The public contract leaves no implementation-time behavior choice:

- Direct `s.markdown(options)` and `s.mdx(options)` returns are immutable dialect/profile roots and ordinary schemas. Each exposes exactly `toc()`, `excerpt(options?)`, and `metadata()` as the finite built-in projection family. Ordinary Zod wrappers need not preserve root methods.
- Top-level `s.toc`, `s.excerpt`, and `s.metadata`, `TocOptions`, `original`, `.project()`, a generic projection protocol, public broker/content capability, public AST/VFile/cache controls, and root `createBuilder` are absent with no compatibility getter, proxy, shim, dialect guesser, or subpath.
- Every root/projection independently selects `explicit string ?? ContentFile.content`. Exact empty/missing input, whitespace, and non-empty no-visible-text behavior is complete. Excerpt, TOC, and metadata use Ticket 20's exact independent algorithms.
- Custom schemas remain arbitrary black-box Zod schemas. They own their selected input, parser, AST, VFile, cache, I/O, mutation, and external side effects. Velite does not infer their selected input or grant shared derivation state.
- `SchemaContext` retains its eight public fields. `collectEffect(effect, context)` accepts only Ticket 23's complete declaration surface. Custom occurrence is exactly `singleton`, `source-index`, or `key`; controlled source ranges remain private.
- `Diagnostic` is the sole exported normalized diagnostic model. Ticket 23's narrow `DiagnosticValue`, complete provenance, total normalizer, structural equality/order, detachment, and runtime immutability are final. There is no public host taxonomy or dedicated Proxy detector.
- `addDiagnostic(PrepareDiagnosticInput)` is the sole prepare diagnostic channel. `PrepareResult.diagnostics` is absent. The sink is append-only, synchronously snapshots input, and closes at hook settlement.
- Strict is durable and runs after prepare finalization and before staging. `BuildOptions.signal` is absent. `prepare(false)` commits logical truth and an empty Publication only after every gate passes.
- `BuildResult.diagnostics` and `BuildResult.operationalDiagnostics` are distinct recursively immutable snapshots. A normal operation returns only after its finite first cleanup attempt and total result construction.
- External readers receive only the current-plus-direct-predecessor Publication window and must reacquire before a second successful pointer advance. No public or private managed-reader acquisition protocol is part of 1.0.

Unsupported untyped calls do not become compatibility promises merely because JavaScript can express them.

### Sole authorities and deep seams

The following ownership is unique:

- The process-owned `SchemaContextHost` propagates active schema execution and checks active-run state. It owns no Builder, epoch, Generation, Publication, content derivation, cache, cleanup, reader, migration, acceptance, or registry state.
- Each record owns one record content derivation lifetime, one effect transaction, and branch-local mutable state. Invalid records discard effects but retain applicable diagnostics, so effect promotion and diagnostic finalization remain separate authorities.
- One pipeline epoch owns its resolved config, schemas, engine, `SessionStore`, derivation factory, profile namespace, and only resources that actually exist.
- One Builder-local `BuilderCoordinator` is the sole logical authority for operation admission, active/warming/draining epochs, watch replay checkpoints, current Generation, current/direct-predecessor Publication, publication authorization, expected bases, commit ordering, synchronous install, cleanup sequencing, disposal state, and derived wait set.
- A Driver produces a complete immutable candidate only. Writers, manifest codecs, filesystem adapters, watcher/scheduler adapters, and the atomic-pointer adapter execute narrow capabilities and own no current truth. Atomic pointer replacement is the external commit linearization primitive, not a second logical authority.
- Ticket 25's `EvidenceProtocol` is the design acceptance authority. A release-phase core `EvidenceBundle` retains content-addressed evidence. A separate `IndependentVerdict` recalculates from that bundle and never participates in its root hash.

No public registry exists. No process-global registry owns Builder, epoch, Generation, Publication, content derivation, transaction, reader, cleanup, migration, or instrumentation state. The process host is an ambient propagation adapter, not a registry or service locator.

### Lifecycle and publication result

The final lifecycle contract is coherent:

- Record derivation retains fulfilled or rejected matching parse work through record close, performs parse-once coalescing, and rejects late mutation after close.
- VFile state continuity crosses the shared parse seam by value; one transforming branch preserves one VFile identity across its own phases; sibling branch mutation remains isolated.
- Epochs use `warming -> active` or `warming/active -> draining -> disposed`. Epoch supersession revokes old-epoch publication authority.
- Builder state is `open -> disposing -> disposed`. Admission before disposal retains ordinary authority while disposal waits; presentation after disposal is rejected. Disposal wait membership derives from actual admitted work and real resources rather than another registry.
- A staged candidate with an incomplete replay checkpoint is stale and must catch up, rebuild, and restage outside the final critical section.
- Full, patch, watch, and reload use the same candidate and publication predicates. Failed operations preserve last-successful Generation and Publication.
- Atomic pointer success precedes synchronous no-`await` Generation/Publication/epoch install. Confirmed pointer success cannot be reclassified.
- Current and direct predecessor remain manifest-protected. Shared blobs remain protected while either manifest references them. No reader pin or wall-clock rule participates.
- Cleanup snapshots one finite plan, awaits one terminal first attempt, persists retry authority, creates immutable operational diagnostics, and then returns a total immutable result. Cold recovery uses sealed current/predecessor/backlog metadata; unknown residue requires explicit clean.
- Late settlement cannot reinstall engine state, append effects/diagnostics, reopen a sink, publish stale output, alter cleanup authority, or cross Builder ownership.

Correctness, branch isolation, record atomicity, last-successful truth, atomic publication, crash recovery, late-settlement fencing, parallel Builder isolation, migration safety, and independent recalculation are preserved.

### Migration result

Ticket 18's canonical inventory contains only `MIG-*` user actions. Broad groups carry no class; every action occurs exactly once and has exactly one `Auto`, `Detect`, or `Manual` class, exact entry point/consequence, artifact kinds, sole owner per artifact kind, independent oracle, and failure condition. The invariant is mechanically checkable.

Root composition/dialect and TOC each use grouped actions rather than user-invisible module splits. `.project()` is `NEG-PROJECTION` negative evidence, not migration. The revision adapter is `ACC-REVISION-ADAPTER` acceptance infrastructure, not migration. Prepare-hook and general Diagnostic-consumer consequences remain distinct and share `OR-DIAGNOSTIC-V1`. External-reader migration describes only the predecessor window. No old `BC-*` identifier is a compatibility alias.

### Evidence result

Ticket 25 is no longer a schema-of-schema promise. The checked-in `evidence-schema.v1.json` and `evidence-protocol.v1.json` instantiate:

- UTF-8 RFC 8785 JCS and exact non-JSON byte rules;
- SHA-256 artifact, tree, protocol, core-bundle, and verdict domains;
- a core manifest with no own root and no IndependentVerdict;
- closed schemas for protocol, core bundle, external verdict, artifact manifest, retained payloads, raw measurements, structural witnesses, derived report, and calculator inputs/outputs;
- a retained-field dictionary with source, type, requiredness, validation, meaning, recalculation use, and omission behavior;
- exact workloads and fixtures;
- a complete stable gate registry with typed paths, class, phase, owner, formula/oracle, pass/fail/invalid, rerun eligibility, and retained outputs;
- exact fixed baseline, A/B/C roles, harness-only adapter, host, pairing, retention, and single-rerun policy; and
- dimensionless ratio, reduction, and normalized allowed-delta margins with no millisecond percentage-point ambiguity.

Private instrumentation is write-only corroborating evidence. Structural hard gates cross-check semantic values, controlled adapters, persisted manifests, state predicates, counters, retention, or exports. Event-name presence cannot pass a hard gate. Bundle-only independent recalculation uses no checkout, live Builder, private object identity, mutable registry, directory enumeration, or candidate-private helper.

Design approval requires these executable contracts, not fabricated implementation results. Actual builds, fixtures, measurements, core bundles, reports, and external verdicts remain mandatory post-implementation release evidence.

### Implementation phases and freedoms

The following names are implementation phases, representations, or acceptance labels rather than stable kernel concepts, modules, interfaces, registries, or object identities:

- parse slot representation;
- pristine artifact, VFile seed, and shared parse snapshot representation or separate type/module names;
- `SchemaRunner`, `SchemaRunContext`, schema-run lease object, and content-capability wrapper representation;
- staging transaction object;
- private publication-authorization revision fields and admitted-operation record representation;
- replay-checkpoint storage representation;
- protected-set calculation;
- cleanup worker and optional trash-rename structure;
- private instrumentation transport and structural event names; and
- protocol artifact-family helper types inside the one versioned EvidenceProtocol.

Implementations may choose maps, collision-safe hashing, clone, ownership transfer, copy-on-write, persistent trees, freeze/copy strategies, scheduling, codecs, platform atomic-pointer adapters, and internal file/type names. They must preserve parse-once, rejected-parse retention through record close, VFile continuity by value, same VFile identity within one transforming branch, sibling mutation isolation, active-run late-call rejection, effect atomicity, atomic pointer, last-successful truth, crash recovery, epoch supersession, parallel Builder isolation, and every public/evidence oracle.

### Effective supersessions

The final design explicitly carries these supersessions:

- Ticket 07 and Ticket 20 supersede Ticket 04's generic `.project()` reservation and any top-level projection compatibility implication.
- Ticket 08 and Ticket 22 supersede any parse sharing based on root identity, hash alone, mutable pristine sharing, or a no-share marker while demoting slot/seed representation names.
- Ticket 23 supersedes Ticket 09's fabricated custom selected-input/actual-path provenance, public custom source range, hidden diagnostic root-cause/subject/fingerprint identity, mutable prepare diagnostics, and facade-owned strict timing.
- Ticket 24 supersedes Ticket 09's non-atomic publication generality and makes strict, Generation, Publication, cleanup, recovery, and result order executable.
- Ticket 25 supersedes Ticket 10's moving/ambiguous baseline, combined-demand shorthand, repeated improvement floor, ambiguous millisecond gate shorthand, and generic boundary-unit wording.
- Ticket 18 supersedes its earlier broad `BC-*` inventory, multi-class rows, `.project()` migration item, acceptance-adapter migration item, broad diagnostic taxonomy, and managed-reader migration text.
- Ticket 23's final convergence supersedes its earlier public custom source-range and host-value taxonomy, including the dedicated Proxy detector.
- Ticket 24's final convergence supersedes the separate generation-publication owner, lifecycle coordinator, stable authorization mechanism objects, protected-manifest registry, managed-reader leases/pins, reader-blocked disposal, and committed-but-no-result defense.
- Ticket 25's final convergence supersedes its earlier meta-requirements, uninstantiated test-oracle numbering, verdict-in-bundle ambiguity, event-only acceptance possibility, reader-pin fixtures, and diagnostic host taxonomy fixtures.
- This section supersedes Ticket 11's earlier reapproval wording wherever it retained those removed concepts.

All other non-conflicting correctness and public-contract decisions remain in force. No superseded clause is a current compatibility or acceptance contract.

### Blocker and contradiction closure

The four hard blockers from the independent minimalism review are closed:

1. The concrete pre-implementation evidence schemas, field mappings, stable gates, canonical bytes, and hash algorithms now exist as authoritative artifacts.
2. The core EvidenceBundle root is non-circular, and IndependentVerdict is outside that hash domain.
3. Migration classification is action-level and mechanically exactly-one.
4. Public custom source-position and fabricated selected-input authority are removed.

The complete cross-ticket review found no remaining hard contradiction and no new contradiction introduced by the convergence. Diagnostic/effect, publication/lifecycle, migration, and evidence contracts use the same current terms, owners, phases, and negative surfaces. There is no managed-reader hypothetical seam, public registry, process-global coordination registry, compatibility shim, product revision adapter, public broker, AST/VFile/cache control, generation registry, reader registry, transaction registry, or instrumentation registry.

The Velite 1.0 shared content derivation kernel is reapproved for implementation planning with no known design blocker.
