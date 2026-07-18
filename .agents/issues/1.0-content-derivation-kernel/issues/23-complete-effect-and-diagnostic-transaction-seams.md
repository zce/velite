# Complete effect and diagnostic transaction seams

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 09, 19

---

## Question

Which interfaces produce stable schema-path, declaration, and occurrence provenance for custom and built-in effects, and how can `prepare` append hook diagnostics while being unable at runtime to mutate, delete, replace, or downgrade core diagnostics?

## Review context

The retained public `collectEffect(effect)` operation does not provide the full provenance required by the declarative effect identity and canonical ordering contract. The current migration decision relies only on TypeScript `readonly`, which neither protects JavaScript callers nor provides a separate append channel. Define narrow, testable collection and diagnostic seams without exposing broker internals.

## Answer

### Selected decision

Keep custom schema effects, but replace `collectEffect(effect)` with a narrow explicit declaration interface for provenance that Velite cannot truthfully recover from an arbitrary Zod callback. Validation owns owner, collection, source, and record identity; callers cannot provide or override them. Velite-owned content branches receive richer provenance from controlled request descriptors, while ordinary built-ins use private declaration helpers with stable semantic recipe provenance. No effect identity may use call time, append position, Promise completion order, cache-hit order, or a runtime visitation counter.

Treat effect collection as a record transaction, not a shared event log. Broker demands retain branch-local outcomes. Each ordinary built-in or custom declaration is synchronously validated and detached before entering a record-local identity-indexed transaction. Only a wholly valid record produces a record effect candidate, and cross-file-invalid records lose that candidate symmetrically.

Before `prepare`, normalize core diagnostics into a detached recursively immutable snapshot. The hook receives that snapshot and exactly one append-only `addDiagnostic()` sink. Hook diagnostics cannot mutate, delete, replace, downgrade, or impersonate core diagnostics. After the hook settles, its declarations are normalized, frozen, deduplicated, and merged into canonical order before Ticket 24's fatal, strict, staging, and publication policy.

This decision does not add a public broker, effect transaction, diagnostic registry, general transaction service, or service locator.

### Terminology and transaction model

- An **effect declaration** is one schema-produced effect kind, its semantic payload, and the declaration context supplied at collection time. It is input to a transaction, not committed state.
- An **effect payload** is the normalized business fact for an existing supported kind, currently a unique registration or asset reference. It contains no owner, collection, source, record, or other system provenance.
- **Effect provenance** is the immutable association attached by the transaction: the system owner and source identity plus semantic declaration path, declaration ordinal, controlled request/projection identity when applicable, and stable occurrence.
- **Effect identity** is `(kind, system owner, complete effective provenance, normalized semantic payload)`. It is independent of discovery and completion order.
- An **effect transaction** validates and snapshots declarations, detects malformed or conflicting declarations, collapses exact duplicates, and promotes effects only through branch, valid-record, cross-file-valid build, and committed-generation seams.
- A **core diagnostic** is produced before `prepare` by Velite's config, discovery, load, schema, cross-file, asset, or other core stages.
- A **hook diagnostic declaration** is append-only input accepted through the prepare sink. It does not become a diagnostic until the sink validates and snapshots it.
- A **diagnostic snapshot** is detached normalized data whose array, diagnostic objects, provenance, source positions, context, cause representations, and all other nested values are recursively immutable at runtime.

The effect promotion states remain:

1. A content demand returns one immutable branch-local outcome.
2. A valid record candidate contains all accepted broker outcomes and ambient declarations for that record.
3. A cross-file-valid build candidate contains only candidates that survive simultaneous uniqueness and other cross-file checks.
4. Ticket 24 may publish only a complete generation candidate that has also completed the prepare diagnostic transaction and all policy gates.

Speculative asset reads, probes, hashes, parse slots, and temporary output remain computation state rather than committed effects.

### Owner, source, path, declaration, occurrence, and identity

Validation creates the stable owner tuple:

```text
(collection configuration order, collection identity, source path,
 record source index, stable record identity)
```

Collection, source, selected Content Input, and record provenance are also system-owned. Public effect payloads and custom declaration contexts must not contain fields that claim or override those values. JavaScript input that attempts to provide reserved owner or source fields is malformed rather than silently trusted or used as an identity input.

The public declaration context is:

```ts
export interface EffectDeclarationContext {
  readonly path: readonly (string | number)[]
  readonly declaration: number
  readonly occurrence: StableOccurrence
}

export type StableOccurrence =
  | { readonly kind: 'singleton' }
  | { readonly kind: 'source-position'; readonly start: number; readonly end?: number }
  | { readonly kind: 'source-index'; readonly index: number }
  | { readonly kind: 'key'; readonly key: string }
```

`path` is a **record-rooted semantic declaration path**, not a claim that Velite recovered the actual runtime Zod nesting path. This distinction is required because Zod 4 success callbacks do not expose their nesting path, and arbitrary optional, union, array, transform, pipe, lazy, and async custom schemas are black boxes under Ticket 19.

Path rules are exact:

- `[]` denotes a declaration at the record root and is valid.
- A string segment must be non-empty. A number segment must be a non-negative safe integer.
- Segments are synchronously copied; mutation of the caller's array is not observable.
- Canonical comparison is segment-by-segment: numeric segments compare numerically, string segments compare by code unit, and a numeric segment sorts before a string segment at the same position. A strict prefix sorts before its extension.
- Numeric path segments denote caller-declared static tuple or semantic path positions. They are not inferred dynamic array traversal indexes.
- A reusable custom schema must receive its semantic mounting path as explicit construction/configuration data when its declarations need distinct identity. Wrappers do not alter that captured semantic path.
- In a union, optional, transform, or pipe, only the branch that actually declares an effect contributes one. The declared path remains the schema author's semantic path; runtime branch selection does not rewrite it.
- Repeated dynamic array elements share the declaration path and must be distinguished by a stable occurrence.

`declaration` is a non-negative safe integer assigned explicitly by a custom schema author to distinguish multiple semantic declaration sites at one path. It is stable construction metadata, not a validation-time counter. Velite-controlled requests and private built-in helpers supply their own recipe/request declaration ordinals. No implementation may derive an ordinal from collector insertion or completion order.

Occurrence rules are exact:

- `source-position` uses zero-based offsets in the authoritative selected input. `end`, when present, must be a safe integer no smaller than `start`.
- `source-index` is allowed only when the integer is an intrinsic ordered position in the source value being processed. It must not be the position at which a declaration happened to reach the collector.
- `key` is a non-empty caller-controlled stable semantic key. The collector snapshots it exactly; callers must normalize domain-specific equivalence before submission.
- `singleton` asserts that this declaration site produces at most one semantic fact per owner. A second declaration with the same occurrence and different payload is malformed.
- When a source position exists, Velite-owned branches use it. When it does not, a controlled branch may use a stable structural locator derived from the input artifact's node/property structure. A structural locator is not an async visitation count and remains internal.
- Custom code without a source position must provide `source-index`, `key`, or a valid `singleton`. There is no automatic fallback.

Two effects are exact duplicates only when kind, system owner, all effective provenance, and normalized payload match. Exact duplicates collapse at branch, record, build, committed, and public-result seams. Equal payloads with different owners, paths, declaration ordinals, request/projection descriptors, or occurrences do not collapse. Reusing one occurrence identity with a different payload is an ambiguous declaration and fails the record rather than selecting a first or last writer.

### Built-in effect provenance

Velite-owned content roots and sibling projections submit private controlled requests. Each request descriptor supplies its root recipe, projection kind, stable request/projection declaration ordinal, selected Content Input identity, and request options. The broker enriches every branch outcome with the validation-owned owner/source tuple. Linked content occurrences use authoritative source ranges when available and otherwise an internal deterministic structural locator captured from the branch input before declarations are committed.

No content request descriptor may contain caller-authored owner, collection, source, or record identity. A controlled descriptor that lacks required internal recipe, request, projection, or occurrence provenance is a Velite invariant violation and throws `VeliteError('internal')`.

Ordinary effect-producing built-ins such as `s.unique()`, `s.file()`, and `s.image()` do not assemble owner tuples. They call an unexported declaration helper that supplies a stable semantic recipe path and recipe declaration ordinal. Their normalized input and operation semantics provide a stable occurrence key or a valid singleton. Two equivalent facts emitted by identical ordinary recipes in one owner may therefore collapse as one declarative fact; Velite does not claim to recover two distinct actual Zod field paths that Zod never exposed.

This lower-fidelity but stable association is intentional. Zod diagnostic paths and effect declaration paths are separate concepts. A schema validation issue still receives its actual path from the final Zod issue. Effect identity uses only provenance that the system or declaration interface can execute deterministically.

### Custom effect declaration interface

The public context retains the field name `collectEffect`, with this breaking signature:

```ts
export type SchemaEffectDeclaration = UniqueEffectDeclaration | AssetReferenceEffectDeclaration

export interface EffectDeclarationContext {
  readonly path: readonly (string | number)[]
  readonly declaration: number
  readonly occurrence: StableOccurrence
}

export interface SchemaContext {
  // Existing fields omitted.
  readonly collectEffect: (effect: SchemaEffectDeclaration, context: EffectDeclarationContext) => void
}
```

Public declaration payloads omit committed owner/provenance fields. `collectEffect` returns `void`. It synchronously validates, normalizes, copies, and records the input in the active record transaction. Subsequent mutation of the payload, descriptor, path array, occurrence object, or nested request data is not observable.

Missing descriptors, reserved provenance fields, illegal segments, unsafe integers, empty keys, unsupported occurrence kinds, conflicting use of one occurrence, or non-normalizable payloads are user declaration errors. They add a deterministic schema-stage declaration diagnostic, invalidate the record, and contribute no effect. They are not `VeliteError('internal')`. A normal custom Zod issue remains a Zod issue and does not enter the internal throw channel. Custom schemas continue to use Zod `addIssue()` for validation problems; `collectEffect` is not a second diagnostic channel.

Custom effects remain limited to the existing supported effect kinds. This decision adds neither arbitrary effect kinds nor a custom projection protocol.

### Branch, ambient declaration, record, and build seams

Broker demands retain branch-local collectors and immutable outcomes. Ordinary built-ins and arbitrary custom Zod schemas cannot be given honest field-local collectors because Zod exposes neither a stable success path nor a general field adaptation callback. Each `collectEffect` invocation instead creates one detached immutable declaration and atomically inserts it into a record-local identity-indexed transaction. The transaction is not a shared append array and has no observable insertion order.

The minimum conceptual internal interface is:

```ts
interface RecordEffectTransaction {
  declare(input: SnapshottedEffectDeclaration): void
  acceptBranch(outcome: ContentBranchOutcome<unknown>): void
  finalize(valid: boolean): RecordEffectCandidate | undefined
  close(): void
}
```

The names and concrete representation are not public requirements. Required behavior is:

- Every record owns a fresh transaction and broker lease.
- Sibling broker branches own separate mutable working state and return immutable outcomes.
- Each ambient declaration is detached before transaction insertion.
- Parallel fields, branches, records, and Builders share no mutable effect array.
- A broker branch failure cannot insert partial branch effects or mutate sibling collectors.
- After all schema work settles, a valid record finalizes one record candidate. An invalid or abandoned record finalizes none and discards every successful sibling effect.
- Applicable diagnostics survive record invalidation.
- Cross-file uniqueness evaluates only locally valid candidates. A conflict invalidates all participating records simultaneously; every participant receives its diagnostic, no winner is selected, and all effects of all participants are discarded.
- Source/build aggregation accepts only cross-file-valid record candidates and canonicalizes without insertion order.
- Record transaction and broker disposal happen in `finally`. Work already started may settle for existing waiters but cannot commit after the lease closes.

### Immutable core diagnostic snapshot

Immediately before invoking `prepare`, the driver builds the core snapshot from every core diagnostic known at that point. It normalizes values, detaches all references, recursively freezes the graph, deduplicates exact duplicates, and canonicalizes order. The snapshot passed to `prepare` and the core portion forwarded to Ticket 24 are the same immutable semantic data, not a mutable original plus a throwaway read-only copy.

The public normalized value domain is conceptually:

```ts
export type ImmutableDiagnosticValue =
  | null
  | boolean
  | number
  | string
  | readonly ImmutableDiagnosticValue[]
  | { readonly [key: string]: ImmutableDiagnosticValue }

export interface ImmutableDiagnostic {
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly stage: DiagnosticStage
  // Optional normalized provenance, source position, subject, context, and cause.
}
```

The exact optional property names follow the final diagnostic model, but their normalization contract is fixed:

- Arrays and plain records are recursively copied, keys are canonicalized, and every node is frozen.
- Errors become frozen data containing stable `kind`, `name`, `message`, optional code, and normalized cause. Stacks and object identity are excluded.
- Source positions, owner/source/request associations, context, and nested causes are recursively detached.
- Date, Map, Set, binary values, symbols, functions, host objects, and other opaque values are represented by deterministic tagged immutable data rather than retained references.
- Cycles become a deterministic circular marker; ordering and identity never depend on memory identity.
- Non-finite numbers and other unsupported scalar states are normalized or rejected by one documented diagnostic normalizer, never left implementation-dependent.
- The top-level array, every diagnostic object, and every nested array/object are runtime frozen.

Mutation attempts may throw in strict JavaScript or fail silently in another environment. The observable contract and test oracle are that neither the supplied snapshot nor final core diagnostics change. Tests must not require one engine-specific mutation exception.

### Prepare hook diagnostic sink

Keep the existing candidate collections as the first prepare argument and use one context as the second:

```ts
export interface PrepareDiagnosticInput {
  readonly key: string
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}

export interface PrepareContext {
  readonly project: ProjectInfo
  readonly diagnostics: readonly ImmutableDiagnostic[]
  readonly addDiagnostic: (diagnostic: PrepareDiagnosticInput) => void
}

export type PrepareResult<C extends Record<string, CollectionDef> = Record<string, CollectionDef>> =
  | void
  | false
  | { readonly collections: PrepareCollections<C> }
```

Remove `PrepareResult.diagnostics`. Returning diagnostics and using the sink simultaneously are not supported. `addDiagnostic()` is the sole hook diagnostic channel.

`key` is a required non-empty stable semantic occurrence key within the one configured prepare hook. The hook controls key, level, code, message, and cause. The system fixes stage to `prepare`, origin to the active hook, and owner to a project-wide sentinel. A 1.0 prepare hook cannot submit `schema`, `asset`, or other core-stage diagnostics and cannot claim collection, source, record, schema path, request, or core provenance. A later design may add a validated subject selector if evidence requires it; arbitrary caller-authored core provenance is not reserved here.

The sink synchronously validates, normalizes, snapshots, and records each input. Later caller mutation is invisible. It never gives the hook a reference to either the core array or the internal hook transaction.

Core and hook diagnostic identities remain distinct by origin/provenance. A hook declaration cannot collide with, override, replace, or downgrade a core identity. Within hook diagnostics, exact normalized duplicates with the same key collapse. Reusing one key with different normalized payload is malformed and creates a system-authored fatal prepare diagnostic; first/last submission order does not choose a winner. Different keys remain distinct even if code and message match.

After the prepare Promise settles, the sink closes before any policy or publication step. Hook diagnostics are then normalized, recursively frozen, deduplicated, and canonicalized, and only then merged with the already immutable core snapshot. Canonical ordering uses the Ticket 09 diagnostic ordering keys plus stable hook origin/key; it never uses sink call order or async completion order.

### Error, failure, concurrency, and lifecycle behavior

- A Velite-owned content request or ordinary built-in helper missing required internal provenance is `VeliteError('internal')` because Velite violated a validated implementation invariant.
- A malformed custom effect payload or declaration context is a deterministic schema-stage declaration diagnostic that invalidates the record. It is not an internal throw.
- A normal custom schema validation issue remains a Zod issue and follows normal field/record invalidation.
- Invalid, abandoned, or disposed records contribute no effects, including effects from successful siblings.
- Unique conflicts invalidate all participants symmetrically and discard every participant's full effect candidate.
- A branch collector failure cannot mutate a record candidate or another branch.
- Mutation attempts against the prepare core snapshot cannot change either the snapshot or final core diagnostics.
- A malformed hook diagnostic declaration creates a fatal system-authored `prepare` diagnostic. It is not an internal invariant failure.
- A prepare throw or rejection is normalized to a fatal `prepare` diagnostic. Hook-owned external side effects are outside rollback guarantees.
- Hook diagnostics cannot downgrade or eliminate a fatal/core diagnostic.
- `prepare(false)` records only output-suppression intent. It cannot bypass core or hook fatal diagnostics, a strict upgrade, staging policy, or Ticket 24's publication gate.
- The prepare sink remains open through all async work awaited by the returned Promise and becomes terminal immediately when that Promise settles.
- A captured sink called after settlement synchronously rejects the call as prepare-hook lifecycle misuse, submits no diagnostic, changes no settled candidate, and never becomes `VeliteError('internal')`. An unawaited callback's resulting user error cannot retroactively alter a completed build.
- Nested or parallel builds own separate core snapshots, hook transactions, sink leases, and candidates. No late callback may resolve against a later build.
- Effect and diagnostic canonical identity, deduplication, and order are invariant under field, branch, record, hook task, and Builder completion permutations.
- Ticket 24 remains the only owner of strict policy, atomic publication, committed generations, reload epoch swap, and drain/dispose. This ticket does not introduce a second publication owner.

### Public and internal interface

The root public contract adds or changes only:

- `SchemaEffectDeclaration`, containing effect payloads without owner/system provenance.
- `EffectDeclarationContext`.
- `StableOccurrence`.
- `SchemaContext.collectEffect(effect, context)`.
- `ImmutableDiagnostic` and its immutable normalized value representation as needed by `PrepareContext` and build results.
- `PrepareDiagnosticInput`.
- `PrepareContext.addDiagnostic` and immutable `PrepareContext.diagnostics`.
- `PrepareResult`, with the diagnostics return branch removed.

The implementation must check root exports, generated declarations, built-dist declarations, package export map, and runtime reflection. It must not expose through those surfaces:

- `RecordOwner`, source enrichment, owner tuple builders, or committed effect provenance internals.
- Content broker, capability, request constructors, request descriptors, branch outcomes, structural locators, or cache state.
- Record/source/build effect collectors or transaction state.
- Diagnostic normalizers, core/hook transaction arrays, sink state, leases, publication candidates, or registries.
- A diagnostic channel on public `SchemaContext`.

Public `context()` continues to return the distinct public view established by Ticket 19. Its effect operation is a leased record capability, not a general transaction service. Custom schema diagnostics continue through Zod `addIssue()`.

### Alternatives rejected

| Alternative                                                     | Rejection reason                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep `collectEffect(effect)` and infer all provenance           | Zod 4 successful transform/refinement payloads expose no nesting path; arbitrary wrappers, unions, arrays, pipes, transforms, and async branches make inference impossible.                                                        |
| Embed provenance in effect payload                              | Conflates declaration with committed fact and lets callers forge owner/source provenance.                                                                                                                                          |
| Promise full built-in provenance but lower custom identity only | Ordinary `s.unique()`, `s.file()`, and `s.image()` execute through the same path-blind Zod callback seam; they cannot honestly recover actual field paths either. Stable semantic recipe provenance is the executable distinction. |
| Inspect Zod internals or runtime stacks                         | Couples identity to unstable private implementation and cannot robustly model conditional/async execution.                                                                                                                         |
| Ambient mutable path tracking                                   | Velite does not control arbitrary Zod object/union traversal; shared mutable tracking races async siblings and becomes another hidden service.                                                                                     |
| Use call, append, completion, cache-hit, or traversal ordinal   | Makes identity and ordering scheduler-dependent.                                                                                                                                                                                   |
| One shared mutable effect accumulator                           | Recreates the invalid-record leak and makes concurrency order observable.                                                                                                                                                          |
| Public branch/field outcome protocol for custom schemas         | Exposes broker/transaction internals and contradicts arbitrary custom schemas as black boxes.                                                                                                                                      |
| TypeScript-only readonly diagnostics                            | Does not protect JavaScript hooks or nested references.                                                                                                                                                                            |
| Shallow copy or shallow freeze                                  | Leaves nested source, context, cause, and position mutable.                                                                                                                                                                        |
| Proxy-only diagnostic view                                      | Retained nested references and proxy/reflection behavior make the contract shallow and representation-dependent.                                                                                                                   |
| Return `{ diagnostics }` from prepare                           | Allows replacement of the entire core set, as the current driver does, and creates ambiguous append/override semantics.                                                                                                            |
| Support both return diagnostics and a sink                      | Creates two competing channels and ordering/lifecycle rules.                                                                                                                                                                       |
| Put core and hook diagnostics in one mutable array              | Allows deletion, replacement, mutation, and downgrade.                                                                                                                                                                             |
| Let hook diagnostics replace the same core identity             | Violates append-only behavior and permits fatal suppression.                                                                                                                                                                       |
| Add diagnostics or a transaction registry to `SchemaContext`    | Creates a second diagnostic channel and turns ambient context into a service locator.                                                                                                                                              |

### Migration consequences

- Every custom call `collectEffect(effect)` must become `collectEffect(effect, { path, declaration, occurrence })`. There is no compatibility shim before 1.0.
- Public effect declaration payloads lose caller-authored `owner` and other system provenance. Existing code that supplies them must delete those fields.
- Custom reusable schemas must accept stable semantic declaration configuration when declarations at different mount sites must remain distinct.
- Dynamic arrays must use an intrinsic source index, stable key, or source position; append/call order is unsupported.
- `PrepareResult.diagnostics` is removed. Hooks append through `context.addDiagnostic()` only.
- Prepare hooks receive normalized immutable diagnostic data, not mutable diagnostics or original `Error` object identity. Code depending on cause mutation, stack, Map/Set methods, Date mutation, or reference identity must migrate to normalized fields.
- JavaScript and TypeScript hooks must treat core diagnostics as runtime immutable. Mutation cannot affect final diagnostics.
- Hook diagnostics are prepare-stage and project-wide in 1.0; hooks cannot migrate by copying a core diagnostic and changing its level.
- `prepare(false)` remains subject to fatal and strict policy and cannot publish around failure.
- Ticket 18 must replace its reopened TypeScript-readonly guidance, add the collectEffect signature and prepare return-shape breaks, and document the distinction between Zod issue paths and semantic effect declaration paths.

### Architecture and knowledge updates required during implementation

Do not edit the knowledge files in this decision ticket. The implementation/spec work must update them as follows:

- `.agents/knowledge/module-architecture.md`: record effect collectors and prepare diagnostic transactions are explicitly factory-owned/lifecycle-owned internal modules; neither becomes a container, registry, public broker, or ambient general transaction service. The leased public `collectEffect` closure remains part of the one schema-run exception.
- `.agents/knowledge/schema-context.md`: document the breaking two-argument `collectEffect`, semantic declaration path and stable occurrence responsibility, owner enrichment, synchronous snapshotting, record lease closure, invalid-record discard, and the prohibition on adding diagnostics/transaction registries to `SchemaContext`.
- `.agents/knowledge/error-handling.md`: distinguish malformed user effect/hook declarations from Velite invariants; define prepare throw/rejection and malformed hook input as fatal prepare diagnostics; define closed-sink late use as hook lifecycle misuse that cannot commit.
- Applicable content/effect/prepare documentation: state that collectors are branch- or record-transaction seams, not event logs; completion and append order have no identity meaning; ordinary built-in provenance is stable semantic recipe provenance rather than a fabricated Zod path.
- Diagnostic documentation: define detached recursive normalization/freeze, opaque cause representation, exact duplicate rules, canonical order, and the mutation-independent test oracle.
- Migration guidance in Ticket 18: list all public signature and return-shape breaks and provide before/after custom effect and prepare examples.

Ticket 12 remains `ready-for-agent`. Its implementation must replace the source-level append array with the exact record transaction/finalize contract above, include unique registration and successful-sibling cases, and merge effects only after local and cross-file validity. No status change is needed in this design ticket.

Ticket 24 receives an immutable candidate whose effect set is record/cross-file finalized and whose diagnostics have completed the prepare transaction. It must not accept or retain mutable diagnostic/effect arrays and remains responsible for fatal/strict policy, staging, atomic publication, generation ownership, epoch swap, drain, and disposal.

### Test oracle and acceptance tests

Representation-specific tests may exercise internal interfaces, but observable tests must remain valid if copy/freeze implementation details change while the semantic contract remains the same.

1. A built-in content effect carries system owner/source identity, semantic declaration path, projection/request ordinal, and stable source-position or structural occurrence provenance.
2. `s.unique()`, `s.file()`, and `s.image()` obtain stable owner enrichment and private semantic recipe provenance without constructing owner tuples.
3. A custom declaration accepts root and nested semantic paths plus each legal occurrence variant.
4. Missing context, illegal/empty string segments, unsafe numbers, empty keys, invalid source ranges, unsupported occurrence kinds, and conflicting singleton declarations produce deterministic schema declaration failures and no effects.
5. Mutation of a submitted effect, path array, occurrence, or nested payload after `collectEffect` returns cannot change the candidate.
6. A caller cannot provide or forge owner, collection, source, selected-input, or record identity.
7. Exact duplicate effects collapse by complete identity.
8. Equal payloads with different path, declaration, occurrence, request/projection, or owner do not collapse.
9. Two parallel custom transforms produce identical identities and canonical output under reversed completion order.
10. Broker branch collectors and record declaration transactions share no mutable effect arrays.
11. A failed branch cannot leak partial effects into its record candidate or sibling collector.
12. A record with one invalid field discards effects from every successful sibling while retaining applicable diagnostics.
13. An abandoned or disposed record contributes no effects and rejects late collection.
14. A unique conflict emits one associated diagnostic for every participant, invalidates all participants simultaneously, and discards every participant's complete sibling effect set.
15. Full and incremental builds produce the same canonical effect identities and order for equivalent live inputs.
16. Prepare receives a diagnostic array detached from all pre-prepare mutable arrays.
17. Prepare cannot push, splice, delete, replace, or reorder core diagnostics observably.
18. Prepare cannot change core diagnostic level, stage, code, message, origin, or identity.
19. Prepare cannot mutate nested source position, owner/source/request association, context, or cause representation.
20. Mutation attempts, whether they throw or fail silently, leave both the supplied snapshot and final core diagnostics unchanged.
21. Errors, cycles, arrays, plain records, Date/Map/Set/binary values, and opaque context normalize to detached frozen deterministic data without retaining mutable references.
22. The sole `addDiagnostic()` sink accepts a valid prepare declaration and adds one prepare-stage project-wide diagnostic.
23. The sink snapshots input synchronously; later caller mutation cannot change the hook diagnostic.
24. A hook cannot claim a core stage/provenance, replace a core identity, or downgrade a fatal diagnostic.
25. Exact hook duplicates collapse, different keys remain distinct, and one key with conflicting payload produces a fatal malformed-prepare diagnostic.
26. Reversing independent hook diagnostic call/completion order does not change identity, deduplication, or canonical order.
27. A prepare throw and rejected Promise each become a fatal prepare diagnostic.
28. Malformed hook input becomes a fatal prepare diagnostic rather than `VeliteError('internal')`.
29. `prepare(false)` cannot bypass an existing core fatal, hook fatal, or strict-upgraded error and cannot itself publish output.
30. A captured sink called after hook settlement fails synchronously, adds nothing, and cannot mutate a completed or later build.
31. Nested and parallel builds isolate core snapshots, hook sinks, terminal leases, and candidates.
32. Existing custom schema Zod `addIssue()` behavior remains independent of effect and prepare diagnostic declaration channels.
33. Public `SchemaContext` exposes the approved `collectEffect` declaration operation but no diagnostic registry, broker, owner builder, collector, or transaction state.
34. Root exports, generated declarations, built declarations, export map, and runtime reflection expose only the approved public declaration/prepare types and operations.
35. Internal broker requests, branch outcomes, structural locators, owners, collectors, transactions, and sink state remain unavailable through supported package imports.
36. Tests compare immutable diagnostic values and unchanged core state, not whether a particular JavaScript engine throws on mutation or whether the implementation uses `Object.freeze` in a particular helper.

### Superseded clauses

This decision narrows the following Ticket 09 wording where it was not executable through the Ticket 19 arbitrary-Zod seam:

- Ticket 09's conceptual `ContentBranchOutcome.path` remains valid for controlled content outcomes only as effective semantic/request provenance; it is not evidence that every successful Zod callback exposes its actual nesting path.
- The statement that every custom effect uses the same complete actual schema-field path rules is replaced by the explicit record-rooted semantic declaration path contract above.
- The statement that every distinct ordinary/custom reference occurrence must remain separate is narrowed: distinct occurrences remain separate when represented by controlled source/structural provenance or an explicit custom occurrence; equivalent ordinary built-in facts with no observable distinct source oracle may collapse as the same declarative fact.
- Ticket 09's field-adapter collector is retained for controlled branch outcomes where such an adapter exists. Arbitrary Zod declarations use the record-local identity-indexed transaction because Zod provides no general successful-field adaptation seam.
- Ticket 09's `prepare` readonly wording is strengthened to detached recursive runtime immutability and a sole append sink.
- Ticket 09's attribution of strict upgrade authority to a post-driver facade is not reaffirmed here; Ticket 24 owns the already-identified correction that strict policy must run before publication.

All other Ticket 09 commitments remain: effects are declarative facts, invalid records discard all sibling effects, uniqueness is simultaneous and symmetric, diagnostics retain full provenance that the producing seam can truthfully supply, exact duplicates alone collapse, completion order is irrelevant, `prepare(false)` cannot bypass failure, and failed builds cannot replace the last successful generation.

### Effects on related tickets

- **Ticket 09:** clarified and partially superseded only where automatic actual Zod paths, unobservable occurrences, field-local arbitrary custom collectors, runtime diagnostic immutability, and strict ownership were overcommitted or incomplete.
- **Ticket 12:** remains `ready-for-agent`; its exact implementation seam is now a fresh record transaction finalized only after local and cross-file validity, with unique and successful-sibling acceptance coverage.
- **Ticket 18:** remains reopened/blocked until it replaces TypeScript-only readonly guidance and incorporates the custom effect descriptor, semantic-path responsibility, normalized diagnostic data, sole sink, and removed diagnostics return branch.
- **Ticket 19:** preserved. The public schema view gains no broker or diagnostic registry; owner enrichment, content requests, outcomes, collectors, and transactions remain private and lease-bound.
- **Ticket 24:** is unblocked by this ticket once its other resolved blockers are satisfied. It receives finalized effects and a completed immutable prepare diagnostic candidate and owns all publication, strict, generation, reload, and epoch lifecycle decisions.

## Reopened by final approval review

Ticket 11 found that the public immutable diagnostic contract still delegates optional property names and parts of scalar and tagged normalization to an undefined final model. Define the complete exported field shape, required and optional rules, normalized context and cause representation, and non-finite scalar behavior while preserving recursive detachment, runtime immutability, and the sole append-only prepare sink.

## Final diagnostic oracle resolution

### Scope and supersession

This resolution closes the narrow public immutable diagnostic oracle gap found by Ticket 11. It does not reopen the selected effect declaration interface, semantic declaration paths, stable occurrences, record-atomic effect transaction, controlled built-in provenance, sole append-only prepare sink, private broker, or Ticket 24 publication and lifecycle ownership.

The exported field model and normalization rules below supersede:

- the conceptual `ImmutableDiagnosticValue` and `ImmutableDiagnostic` declarations in **Immutable core diagnostic snapshot**;
- the sentence that deferred optional diagnostic property names to a later final model;
- every earlier allowance to choose scalar tags, opaque tags, Error stack handling, object property enumeration, cycle representation, Map/Set ordering, binary representation, or unknown-field behavior during implementation;
- the earlier `PrepareDiagnosticInput`, `PrepareContext.diagnostics`, and hook normalization wording only where the exact types and validation rules below are more specific; and
- any implication that current mutable `Diagnostic`, closed `DiagnosticCode`, optional `stage`, original `cause` references, `JSON.stringify`, `structuredClone`, insertion order, object identity, class names, host-object strings, or a particular freeze helper are 1.0 diagnostic semantics.

All non-conflicting effect and prepare transaction clauses in the existing answer remain in force.

### Complete exported TypeScript surface

The root public package exports the following diagnostic types. `Diagnostic` is the one normalized snapshot type used by prepare, successful build results, and rejected public build errors. `ImmutableDiagnostic` is not a second shape or a mutable pre-normalization variant.

```ts
export type DiagnosticLevel = 'error' | 'warn' | 'info'

export type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

export type DiagnosticOrigin = { readonly kind: 'core' } | { readonly kind: 'prepare-hook'; readonly key: string } | { readonly kind: 'velite' }

export interface DiagnosticCollectionProvenance {
  readonly order: number
  readonly id: string
}

export interface DiagnosticSourceProvenance {
  readonly path: string
}

export interface DiagnosticRecordProvenance {
  readonly index: number
  readonly id: string
}

export interface DiagnosticRequestProvenance {
  readonly kind: string
  readonly declaration: number
  readonly projection?: string
  readonly occurrence?: StableOccurrence
}

export type DiagnosticProvenance =
  | { readonly scope: 'project' }
  | {
      readonly scope: 'collection'
      readonly collection: DiagnosticCollectionProvenance
    }
  | {
      readonly scope: 'source'
      readonly collection?: DiagnosticCollectionProvenance
      readonly source: DiagnosticSourceProvenance
    }
  | {
      readonly scope: 'record'
      readonly collection: DiagnosticCollectionProvenance
      readonly source: DiagnosticSourceProvenance
      readonly record: DiagnosticRecordProvenance
      readonly path?: readonly (string | number)[]
      readonly request?: DiagnosticRequestProvenance
    }

export interface DiagnosticPoint {
  readonly line?: number
  readonly column?: number
  readonly offset?: number
}

export interface DiagnosticPosition {
  readonly start: DiagnosticPoint
  readonly end?: DiagnosticPoint
}

export type DiagnosticArrayItem = DiagnosticValue | { readonly type: 'hole' }

export type DiagnosticBinaryKind =
  | 'array-buffer'
  | 'data-view'
  | 'int8'
  | 'uint8'
  | 'uint8-clamped'
  | 'int16'
  | 'uint16'
  | 'int32'
  | 'uint32'
  | 'float32'
  | 'float64'
  | 'bigint64'
  | 'biguint64'

export type DiagnosticOpaqueKind = 'function' | 'class-instance' | 'host-object' | 'proxy' | 'shared-binary' | 'reflection-failure'

export type DiagnosticValue =
  | null
  | boolean
  | string
  | number
  | { readonly type: 'undefined' }
  | {
      readonly type: 'number'
      readonly value: 'nan' | 'positive-infinity' | 'negative-infinity' | 'negative-zero'
    }
  | { readonly type: 'bigint'; readonly value: string }
  | {
      readonly type: 'symbol'
      readonly scope: 'well-known' | 'global' | 'local'
      readonly value: string | null
    }
  | {
      readonly type: 'array'
      readonly items: readonly DiagnosticArrayItem[]
      readonly properties: readonly (readonly [string, DiagnosticValue])[]
    }
  | {
      readonly type: 'object'
      readonly prototype: 'object' | 'null'
      readonly entries: readonly (readonly [string, DiagnosticValue])[]
    }
  | { readonly type: 'accessor'; readonly get: boolean; readonly set: boolean }
  | {
      readonly type: 'error'
      readonly name: string
      readonly message: string
      readonly code?: DiagnosticValue
      readonly cause?: DiagnosticValue
    }
  | { readonly type: 'date'; readonly value: number | null }
  | {
      readonly type: 'map'
      readonly entries: readonly (readonly [DiagnosticValue, DiagnosticValue])[]
    }
  | { readonly type: 'set'; readonly values: readonly DiagnosticValue[] }
  | {
      readonly type: 'binary'
      readonly kind: DiagnosticBinaryKind
      readonly bytes: string
    }
  | { readonly type: 'circular' }
  | { readonly type: 'opaque'; readonly kind: DiagnosticOpaqueKind }

export interface Diagnostic {
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly stage: DiagnosticStage
  readonly origin: DiagnosticOrigin
  readonly provenance: DiagnosticProvenance
  readonly position?: DiagnosticPosition
  readonly context?: DiagnosticValue
  readonly cause?: DiagnosticValue
}

export interface PrepareDiagnosticInput {
  readonly key: string
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}

export interface PrepareContext {
  readonly project: ProjectInfo
  readonly diagnostics: readonly Diagnostic[]
  readonly addDiagnostic: (diagnostic: PrepareDiagnosticInput) => void
}

export type PrepareResult<C extends Record<string, CollectionDef> = Record<string, CollectionDef>> =
  | void
  | false
  | { readonly collections: PrepareCollections<C> }
```

`Diagnostic.level`, `code`, `message`, `stage`, `origin`, and `provenance` are required. Only `position`, `context`, and `cause`, plus the explicitly optional nested fields shown above, may be absent. A produced `Diagnostic` contains no unknown own string or symbol fields. Public `code` is `string` because a prepare hook declares its own stable code; Velite may retain a narrower private union for Velite-authored codes, but that union is not the result type.

The source provenance path is the normalized project-relative POSIX source path. Collection `order`, record `index`, request `declaration`, path number segments, point coordinates, and occurrence numbers follow their existing non-negative safe-integer rules except that line and column are positive safe integers. A `DiagnosticPoint` must contain at least one of `line`, `column`, or `offset`; `end`, when present, must not precede `start` on any coordinate present in both points. Empty IDs, source paths, request kinds, codes, and prepare keys are invalid. Messages may be empty strings. Project-wide diagnostics use `{ scope: 'project' }` rather than fabricated collection, source, record, path, request, or position values.

`DiagnosticOrigin` is independent of stage. Normal core producers use `{ kind: 'core' }`; an accepted hook declaration uses `{ kind: 'prepare-hook', key }`; a diagnostic Velite creates for malformed hook input, key conflict, hook throw/rejection, staging failure, or another system-owned operation failure uses `{ kind: 'velite' }`. A prepare hook cannot submit any origin or provenance field.

### Pre-normalization and snapshot boundary

Core producers may use private, mutable diagnostic builder inputs containing original exceptions and internal owner/request objects. Those inputs are not exported diagnostic values. Immediately before `prepare`, Velite validates their required associations, converts them to the public `Diagnostic` model, normalizes `context` and `cause`, detaches every value, deduplicates exact normalized identities, canonicalizes order, and recursively makes the resulting graph runtime immutable.

The resulting core array is the exact array supplied as `PrepareContext.diagnostics`. Hook declarations are normalized into the same `Diagnostic` type, merged after the sink closes, and passed unchanged in meaning to Ticket 24. Successful `BuildResult.diagnostics` and rejected public build errors expose this same normalized type. Publication, logging, error construction, and result construction must not reinterpret causes, restore original references, change provenance, or create a looser diagnostic shape.

`PrepareDiagnosticInput` is intentionally not `Diagnostic`: a hook declares only `key`, `level`, `code`, `message`, and optional raw `cause`; Velite supplies stage, origin, and project provenance. TypeScript declarations, built declarations, root exports, runtime objects, JavaScript reflection, and untyped JavaScript validation must agree with these surfaces.

### Normalized scalar oracle

Normalization produces a tree in the exact `DiagnosticValue` domain:

| Input                         | Normalized value                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `null`, boolean, string       | The scalar unchanged; strings receive no trimming or Unicode normalization                                 |
| Finite number other than `-0` | The number unchanged                                                                                       |
| `NaN`                         | `{ type: 'number', value: 'nan' }`                                                                         |
| `Infinity`                    | `{ type: 'number', value: 'positive-infinity' }`                                                           |
| `-Infinity`                   | `{ type: 'number', value: 'negative-infinity' }`                                                           |
| `-0`                          | `{ type: 'number', value: 'negative-zero' }`                                                               |
| `undefined`                   | `{ type: 'undefined' }`                                                                                    |
| bigint                        | `{ type: 'bigint', value }`, where `value` is the canonical base-10 `BigInt.prototype.toString(10)` result |
| well-known symbol             | A symbol tag with `scope: 'well-known'` and its fixed ECMAScript well-known name                           |
| `Symbol.for(key)`             | A symbol tag with `scope: 'global'` and `value: key`                                                       |
| local symbol                  | A symbol tag with `scope: 'local'` and its description or `null`                                           |
| function                      | `{ type: 'opaque', kind: 'function' }`; name, length, source, properties, and identity are not read        |

Two distinct local symbols with the same description normalize equally. This is deliberate: unobservable memory identity is not diagnostic identity. Symbols used as object property keys are excluded under the property rules below; symbol values remain representable by the symbol tag.

### Compound, object, and host-value oracle

Normalization does not invoke `toJSON()`, a user getter, a setter, or a user method. It uses captured trusted built-in operations and own property descriptors only after classifying Proxy and built-in brands. The result rules are:

- **Arrays:** preserve `length`, numeric index order, and holes. An absent index becomes `{ type: 'hole' }`; an enumerable accessor index becomes the accessor tag without invocation. Own enumerable non-index string properties are normalized into `properties` in UTF-16 code-unit key order. `length` and other non-enumerable properties are not copied.
- **Plain objects:** only objects whose prototype is exactly the ordinary object prototype or `null` become an object tag. The tag records which prototype category applied. Own enumerable string properties become sorted `[key, value]` entries. A data descriptor is recursively normalized; an accessor descriptor becomes `{ type: 'accessor', get, set }` without invoking either function.
- **Non-enumerable and symbol-keyed properties:** do not enter normalized context or cause data. Their presence does not alter an otherwise supported array or plain object. This exclusion does not apply to `PrepareDiagnosticInput`, whose stricter declaration validation rejects symbol keys and unknown keys.
- **Date:** a branded Date becomes `{ type: 'date', value }`, where `value` is the finite epoch-millisecond result of the captured intrinsic operation, or `null` for an invalid Date. No ISO string, locale string, `toJSON()`, or original Date reference is retained.
- **Map:** a branded Map becomes a map tag. Keys and values are recursively normalized. Entries are then sorted by the canonical value order, first by key and then by value. Entries that become equal after normalization retain their multiplicity. Map insertion order is not semantic.
- **Set:** a branded Set becomes a set tag whose normalized values are sorted by canonical value order. Values that become equal after normalization retain their multiplicity. Set insertion order is not semantic.
- **ArrayBuffer and typed binary:** an ArrayBuffer copies all bytes. A DataView or typed array copies exactly the bytes covered by its view and records the listed binary kind. Bytes are encoded as two lowercase hexadecimal digits per byte. No buffer, view, offset object, or typed-array method survives. A detached or concurrently invalidated ordinary buffer becomes `reflection-failure`.
- **Shared binary:** `SharedArrayBuffer` and views backed by shared memory become `{ type: 'opaque', kind: 'shared-binary' }`; Velite does not claim an atomic deterministic snapshot of concurrently mutable shared bytes.
- **Error:** a branded Error becomes an error tag. `name` is a safe string data value when available, otherwise the recognized intrinsic Error-family name or `Error`; `message` is a safe string data value or `''`; an own data `code` is recursively normalized; an own data `cause` is recursively normalized. An accessor-valued `code` or `cause` becomes the accessor tag. Error `cause` may therefore contain another error tag, a primitive, an object, a circular marker, or any other `DiagnosticValue`.
- **Error stack:** `stack` is never read, exported, ordered, fingerprinted, or used for identity. This rule does not remove stack behavior from an independently thrown JavaScript `Error`; it only governs diagnostic snapshots.
- **Class instances:** every non-built-in object with a non-plain prototype becomes `{ type: 'opaque', kind: 'class-instance' }`. Constructor names, class names, instance fields, custom tags, and methods are not retained.
- **Other host objects:** become `{ type: 'opaque', kind: 'host-object' }`. Velite does not call string conversion or expose runtime-specific host names.
- **Proxy:** every Proxy becomes `{ type: 'opaque', kind: 'proxy' }` before ordinary property reflection. Proxy detection is a private runtime capability, not a public normalizer or service. A Proxy does not gain ordinary-object semantics merely because its traps imitate one.
- **Throwing or inconsistent reflection:** if trusted classification, descriptor access, built-in iteration, or byte copying cannot complete, the value at that position becomes `{ type: 'opaque', kind: 'reflection-failure' }`. Normalization never propagates a user getter exception because getters are not called.

A non-ancestor repeated reference is normalized independently at every occurrence, so alias identity is not preserved. A reference to any current ancestor becomes `{ type: 'circular' }`. The marker carries no object ID, visitation number, or path. Thus cycles terminate deterministically without preserving arbitrary graph topology, and object identity cannot affect equality, ordering, or output. Traversal uses the canonical array/key rules above, not discovery or completion order.

### Canonical equality and ordering oracle

Exact normalized equality is recursive structural equality over the public tags and scalars. A hash may accelerate lookup only if collisions are resolved by complete structural comparison. `JSON.stringify`, `structuredClone`, object identity, freeze-helper identity, property insertion order, Map/Set insertion order, Promise completion order, and hash equality alone are not oracles.

The independent canonical comparator uses the variant order in the written `DiagnosticValue` union: scalar `null`, boolean, string, finite number, then the tagged variants in their declaration order. Values of one variant compare lexicographically by their written fields. Strings and property keys compare by UTF-16 code unit; booleans compare `false` before `true`; finite numbers compare numerically; bigints compare by numeric sign and canonical magnitude rather than decimal string length alone; arrays compare item-by-item with holes as their own variant, then properties; objects compare prototype tag and sorted entries; binary compares kind then hexadecimal bytes. Compound values compare recursively. This comparator supplies Map/Set sorting and the stable context/cause tie-breaker required by Ticket 09.

Diagnostic exact-duplicate identity remains Ticket 09's complete identity: `level`, `code`, `message`, `stage`, `origin`, complete provenance, position, normalized context, and normalized cause. Different field, source, record, request, occurrence, prepare key, or origin associations never collapse. Canonical diagnostic ordering remains Ticket 09's ordering, using the normalized comparator only for its final stable subject/context/cause tie-breakers. Missing optional fields use one fixed leading sentinel and never inherit insertion order.

### Recursive detachment and runtime immutability oracle

Every public diagnostic graph is detached before publication to a caller. No original Error, Date, Map, Set, ArrayBuffer, typed array, class instance, host object, Proxy, array, plain object, position, provenance, context, cause, path, occurrence, or caller-owned tuple remains reachable.

The top-level diagnostic array and every diagnostic, origin, provenance, collection/source/record/request object, path array, occurrence object, position/point object, context/cause tag, entry tuple, nested array, and nested object are recursively immutable at runtime. An attempted write, delete, define, prototype change, array mutation, or nested mutation may throw or fail silently according to JavaScript execution semantics, but subsequent observation of the snapshot and final diagnostics must produce the original values. The public contract does not prescribe `Object.freeze`, a proxy, a clone library, helper identity, traversal implementation, or freeze timing beyond completion before exposure.

Nested and parallel builds own distinct normalization traversal state, core arrays, hook transactions, sink leases, and final snapshot graphs. They do not share mutable diagnostic arrays or normalized nodes. A caller must not rely on object identity being shared even when two snapshots contain equal normalized data.

### Sole append-only prepare sink

`prepare` receives the detached recursively immutable core `readonly Diagnostic[]` defined above. `addDiagnostic()` accepts only `PrepareDiagnosticInput`; it does not accept a complete `Diagnostic` and is the sole hook diagnostic channel. `PrepareResult.diagnostics` remains removed.

Runtime declaration validation is exact:

1. The input must be a non-Proxy plain record with ordinary-object or null prototype.
2. Its only own keys are the string keys `key`, `level`, `code`, `message`, and optional `cause`. Any own symbol key or additional string key is malformed, whether enumerable or not.
3. Every supplied field is an own data property. Accessors are malformed and are never invoked. A custom prototype other than the ordinary object prototype or `null` is malformed, so inherited declaration fields are not accepted.
4. `key` and `code` are non-empty strings used byte-for-byte without trimming or Unicode normalization. `message` is a string and may be empty. `level` is exactly `error`, `warn`, or `info`.
5. `cause`, when present, is synchronously normalized and detached by the diagnostic oracle before `addDiagnostic()` returns. A later caller mutation is unobservable.
6. A hook cannot submit `stage`, `origin`, `provenance`, `position`, `context`, owner, collection, source, record, schema path, request, projection, occurrence, fatal-policy, or publication fields.

Velite supplies `stage: 'prepare'`, `origin: { kind: 'prepare-hook', key }`, and `provenance: { scope: 'project' }`. The key is a stable non-empty semantic occurrence identifier within the one configured prepare hook. It is part of identity and canonical order; call position and task completion are not.

Two declarations are exact duplicates only when key, level, code, message, and normalized cause all match; they collapse to one hook diagnostic. Reusing one key with any different normalized payload creates one Velite-authored fatal `prepare` conflict diagnostic for that key. No submitted winner is selected, and reversing calls produces the same result. Different keys remain distinct even when all other payload fields match.

A malformed declaration creates a Velite-authored fatal `prepare` diagnostic and contributes no hook-authored diagnostic. Multiple malformed declarations with no valid stable key collapse by their normalized Velite-authored identity rather than call ordinal. A thrown or rejected hook similarly becomes a Velite-authored fatal `prepare` diagnostic with its reason normalized through the same cause oracle. These cases are user/hook failures, not `VeliteError('internal')` invariant violations.

The sink is open through all work awaited by the hook's returned Promise. It closes synchronously when the hook return value or Promise settles, before final merge or any Ticket 24 policy gate. A captured sink called after closure synchronously throws a prepare-hook lifecycle-misuse error, appends nothing, changes no completed candidate, cannot target a later build, and is not an internal invariant error. Hook-owned external side effects remain outside Velite rollback.

The hook cannot mutate, delete, replace, reorder, copy-and-downgrade, or impersonate a core diagnostic. A hook `error`, `warn`, or `info` is an additional prepare-stage fact only. Existing core fatal diagnostics and strict-upgraded schema diagnostics remain authoritative. `prepare(false)` records output suppression only and hands the completed immutable set to Ticket 24; it bypasses no fatal, strict, staging, or publication gate.

### Independent reference fixtures and acceptance evidence

Implementation acceptance must include a test-owned normalizer and comparator that implement this written oracle without importing candidate-private helpers. At minimum, exact fixtures cover:

- `undefined`, `NaN`, both infinities, `-0`, positive/negative/zero bigint, all three symbol scopes, and functions;
- finite numbers including ordinary zero, strings without Unicode normalization, and nested scalar arrays;
- sparse arrays, enumerable non-index properties, ordinary and null-prototype records, sorted keys, enumerable accessors, ignored non-enumerable properties, and ignored symbol keys;
- valid and invalid Date values;
- Error name/message/code, primitive cause, nested Error cause, object cause, cyclic cause, accessor cause, and the complete absence of stack;
- Map and Set inputs constructed in opposite insertion orders yielding equal normalized output, including entries that collide only after opaque normalization;
- every binary kind, viewed byte ranges, detached-buffer failure, and shared-binary opacity;
- class instances with different constructor names yielding the same class-instance marker, host objects without stringification, functions without names, and local symbols with equal descriptions;
- repeated references expanded independently, self-cycles and multi-node cycles terminating in circular markers, and no retained alias identity;
- Proxy inputs producing the proxy marker without ordinary property traversal, and throwing reflection producing the reflection-failure marker;
- recursive runtime mutation attempts at the array, diagnostic, origin, provenance, path, request, occurrence, position, context, cause, entry-tuple, and nested-value levels, asserting unchanged values rather than a particular thrown exception;
- core snapshot detachment from mutable producer data, same-type flow through prepare and Ticket 24, and absence of unknown output fields;
- valid hook declarations, every missing/wrong/extra/accessor/symbol-key declaration case, synchronous cause snapshot timing, exact duplicate collapse, same-key conflict under reversed calls, distinct keys, hook throw/rejection, sink closure, late calls, `prepare(false)`, and nested/parallel build isolation;
- root exports, source declarations, built declarations, package export map, runtime own keys, and reflection showing the complete approved public types while exposing no normalizer, Proxy detector, mutable collector, transaction, registry, broker, owner builder, sink state, lease, or publication capability.

Fixtures compare complete normalized structures and canonical order. They do not compare implementation object identity, a specific mutation exception, a specific freeze helper, Error stacks, host strings, candidate hashes without collision checks, or pre-1.0 diagnostic objects.

### Cross-ticket handoff

- **Define content schema migration guidance:** must replace any generic phrase such as “normalized causes” with this exact field/tag model; state that `Diagnostic` has required stage/origin/provenance, unknown output fields are absent, hook input accepts only five declared fields, Error stack/class/reference identity are removed, Map/Set/binary/Date become immutable data, and mutation at every depth cannot alter results. Its final-approval evidence language remains its own reopened decision.
- **Define generation publication and epoch lifecycle:** receives this completed immutable `Diagnostic[]` as its single diagnostic truth. It may append only separately normalized Velite-authored operation-failure diagnostics by producing a new immutable set; it cannot reinterpret, mutate, thaw, or reconstruct causes. Cleanup and immutable `BuildResult.operationalDiagnostics` timing remain Ticket 24's reopened decision and are not decided here.
- **Make performance acceptance executable:** must add independent diagnostic-normalizer/comparator fixtures, exact hook transaction counters, recursive mutation probes, private-export/reflection evidence, and same-result checks under reversed record/hook completion order. The executable evidence contract is design-time; completed implementation and release evidence remain post-implementation artifacts under that ticket's reopening.
- **Approve the complete 1.0 content derivation design:** may now review one complete public immutable diagnostic oracle rather than an implementation-time placeholder. This ticket does not approve the complete design or enter implementation planning.

No new cross-ticket hard contradiction was found in this diagnostic oracle. Ticket 24's already-recorded cleanup/result timing contradiction and Tickets 18/25's already-recorded design-approval versus post-implementation evidence wording remain confined to their reopened scopes.

The content broker, diagnostic normalizer, Proxy detector, effect and diagnostic transactions, mutable collectors, registries, owner/source enrichers, sink state, leases, publication candidate, generation owner, and lifecycle state remain private or absent. No public broker, diagnostic registry, mutable channel, generic transaction service, instrumentation service, or service locator is introduced.

No product code, documentation, examples, tests, benchmark implementation, knowledge file, prototype, report, implementation ticket, implementation spec, or implementation plan was created or changed while resolving this decision.

## Final concept-convergence resolution

### Authority and supersession

This section is the current and complete Ticket 23 contract. Earlier sections remain decision history only. This section supersedes every conflicting earlier effect-occurrence, selected-input-provenance, diagnostic-value, comparator, prepare-validation, acceptance-fixture, and private-capability clause in this ticket.

In particular:

- public custom `source-position` is removed;
- selected Content Input is not system-supplied provenance for an arbitrary custom schema;
- the previous symbol, accessor, Date, Map, Set, binary, class, host, Proxy, and reflection-failure public tag taxonomy is removed;
- no dedicated Proxy-detection capability exists;
- the earlier `ImmutableDiagnostic`, `ImmutableDiagnosticValue`, `DiagnosticArrayItem`, `DiagnosticBinaryKind`, and `DiagnosticOpaqueKind` names are not 1.0 exports; and
- diagnostic equality and ordering no longer depend on Ticket 09's hidden root-cause identity, subject key, or fingerprint language.

The retained invariants are unchanged: complete truthful top-level diagnostic provenance, deterministic equality and ordering, recursive detachment and runtime immutability, no original references or stacks, the sole append-only prepare sink, record-atomic effect promotion, symmetric uniqueness failure, exact-duplicate collapse only, and no public broker, transaction, normalizer, comparator, detector, registry, or lifecycle state.

### Complete public TypeScript surface

The following is the final public effect, diagnostic, and prepare surface. Names referenced from the existing public schema context, such as `ProjectInfo`, `ContentFile`, `ContentRecord`, `SessionStore`, `AssetRequest`, `AssetResult`, `ImageMetadata`, `BlurOptions`, `CollectionDef`, and `PrepareCollections`, retain their independently approved definitions.

```ts
export type StableOccurrence =
  | { readonly kind: 'singleton' }
  | { readonly kind: 'source-index'; readonly index: number }
  | { readonly kind: 'key'; readonly key: string }

export interface EffectDeclarationContext {
  readonly path: readonly (string | number)[]
  readonly declaration: number
  readonly occurrence: StableOccurrence
}

export interface UniqueEffectDeclaration {
  readonly type: 'unique'
  readonly group: string
  readonly value: string
}

export interface AssetReferenceEffectDeclaration {
  readonly type: 'asset'
  readonly source: string
  readonly output: {
    readonly base: string
    readonly template: string
  }
  readonly metadata: boolean
  readonly blur?: {
    readonly width?: number
    readonly height?: number
    readonly quality?: number
  }
}

export type SchemaEffectDeclaration = UniqueEffectDeclaration | AssetReferenceEffectDeclaration

export interface SchemaContext {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
  readonly collectEffect: (effect: SchemaEffectDeclaration, context: EffectDeclarationContext) => void
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}

export type DiagnosticLevel = 'error' | 'warn' | 'info'

export type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

export type DiagnosticOrigin = { readonly kind: 'core' } | { readonly kind: 'prepare-hook'; readonly key: string } | { readonly kind: 'velite' }

export interface DiagnosticCollectionProvenance {
  readonly order: number
  readonly id: string
}

export interface DiagnosticSourceProvenance {
  readonly path: string
}

export interface DiagnosticRecordProvenance {
  readonly index: number
  readonly id: string
}

export interface DiagnosticRequestProvenance {
  readonly kind: string
  readonly declaration: number
  readonly projection?: string
  readonly occurrence?: StableOccurrence
}

export type DiagnosticProvenance =
  | { readonly scope: 'project' }
  | {
      readonly scope: 'collection'
      readonly collection: DiagnosticCollectionProvenance
    }
  | {
      readonly scope: 'source'
      readonly collection?: DiagnosticCollectionProvenance
      readonly source: DiagnosticSourceProvenance
    }
  | {
      readonly scope: 'record'
      readonly collection: DiagnosticCollectionProvenance
      readonly source: DiagnosticSourceProvenance
      readonly record: DiagnosticRecordProvenance
      readonly path?: readonly (string | number)[]
      readonly request?: DiagnosticRequestProvenance
    }

export interface DiagnosticPoint {
  readonly line?: number
  readonly column?: number
  readonly offset?: number
}

export interface DiagnosticPosition {
  readonly start: DiagnosticPoint
  readonly end?: DiagnosticPoint
}

export type DiagnosticValue =
  | null
  | boolean
  | string
  | number
  | { readonly type: 'undefined' }
  | {
      readonly type: 'number'
      readonly value: 'negative-infinity' | 'negative-zero' | 'nan' | 'positive-infinity'
    }
  | { readonly type: 'bigint'; readonly value: string }
  | readonly DiagnosticValue[]
  | {
      readonly type: 'record'
      readonly entries: readonly (readonly [string, DiagnosticValue])[]
    }
  | {
      readonly type: 'error'
      readonly name: string
      readonly message: string
      readonly code?: DiagnosticValue
      readonly cause?: DiagnosticValue
    }
  | { readonly type: 'circular' }
  | { readonly type: 'opaque' }

export interface Diagnostic {
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly stage: DiagnosticStage
  readonly origin: DiagnosticOrigin
  readonly provenance: DiagnosticProvenance
  readonly position?: DiagnosticPosition
  readonly context?: DiagnosticValue
  readonly cause?: DiagnosticValue
}

export interface PrepareDiagnosticInput {
  readonly key: string
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}

export interface PrepareContext {
  readonly project: ProjectInfo
  readonly diagnostics: readonly Diagnostic[]
  readonly addDiagnostic: (diagnostic: PrepareDiagnosticInput) => void
}

export type PrepareResult<C extends Record<string, CollectionDef> = Record<string, CollectionDef>> =
  | void
  | false
  | { readonly collections: PrepareCollections<C> }

export type PrepareHook<C extends Record<string, CollectionDef> = Record<string, CollectionDef>> = (
  collections: PrepareCollections<C>,
  context: PrepareContext
) => PrepareResult<C> | Promise<PrepareResult<C>>
```

`number` in `DiagnosticValue` denotes only finite numbers other than negative zero. Exceptional numeric values use the explicit number tag.

### Effect declaration and authority oracle

Velite supplies collection order and identity, source-file identity, record source index and identity, and system owner. A custom schema owns its selected input. Velite neither observes nor validates which arbitrary Zod value the custom callback selected and therefore supplies no selected-input provenance for a custom declaration.

`path` is a caller-declared record-rooted semantic declaration path, not a Zod issue path or selected-input claim. A string segment is non-empty. A number segment and `declaration` are non-negative safe integers. Inputs are synchronously detached.

`source-index` is a caller-owned semantic assertion. Velite validates only that `index` is a non-negative safe integer. `key` is a non-empty caller-owned semantic key preserved byte-for-byte without trimming or Unicode normalization. `singleton` asserts at most one semantic payload at that declaration site. Exact repeated declarations collapse; the same effective identity with a different normalized payload invalidates the record.

An untyped JavaScript declaration containing any other occurrence kind is malformed, contributes no effect, and emits the deterministic schema-stage declaration diagnostic. There is no custom source-range fallback.

A unique `group` is non-empty; `value` is any string and is preserved byte-for-byte. An asset `source` is a non-empty canonical content-root-relative POSIX path with no leading slash, backslash, empty segment, `.` segment, or `..` segment. `output.base` and `output.template` are non-empty. Blur width and height, when present, are positive safe integers; quality, when present, is an integer from 1 through 100. Unknown fields, accessors, inherited declaration fields, and caller-authored owner, collection, source-file, record, selected-input, request, publication, or resolved-output provenance are malformed.

Velite-controlled roots and projections may retain a private authoritative half-open source range `[start, end)` in their exact selected Content Input, where both offsets are non-negative safe integers and `end >= start`. They may use a private deterministic structural locator when no range exists. Neither private representation is a member of `StableOccurrence`, accepted by custom `collectEffect`, exported, or treated as a custom selected-input claim.

Every record owns one fresh effect transaction. Custom declarations are detached before insertion. Controlled branch outcomes remain branch-local until accepted. Invalid, abandoned, or disposed records promote no effects, including successful sibling effects. Cross-file uniqueness is simultaneous and symmetric: every participant in a `(group, value)` conflict becomes invalid, receives its associated diagnostic, and loses its complete record effect candidate. No source, insertion, or completion order selects a winner.

Exact effect duplicates collapse only by kind, system owner, complete effective provenance, and normalized semantic payload. Canonical effect order compares collection order/identity, source path, record source index/identity, semantic path, declaration, occurrence, controlled private request/source locator when applicable, kind, and normalized payload. No append, call, visitation, cache-hit, or Promise-completion ordinal participates.

### Diagnostic validation oracle

Every produced diagnostic contains exactly the declared own string fields and no own symbol fields. Only `position`, `context`, `cause`, and the explicitly optional nested fields may be absent.

Collection order, record index, request declaration, path number segments, offsets, and `source-index` are non-negative safe integers. Lines and columns are positive safe integers. IDs, source paths, request kinds, projections when present, diagnostic codes, and prepare keys are non-empty. Messages may be empty. Source paths are normalized project-relative POSIX paths.

A `DiagnosticPoint` contains at least one coordinate. Offsets are zero-based; lines and columns are one-based. If both endpoints contain offsets, `end.offset >= start.offset`. If both contain lines, `end.line >= start.line`; when the lines are equal and both columns exist, `end.column >= start.column`. If both offset and line comparisons are available, both must hold. Coordinates absent from either endpoint impose no ordering condition. Thus a later line may validly have a smaller column.

A producer uses the most specific provenance it can truthfully supply. Project-wide facts use project scope. No producer fabricates collection, source, record, path, request, occurrence, or position data. A controlled private source range may become public `DiagnosticPosition` only when the producing branch truthfully maps it to the named source.

### Complete normalization oracle

Normalization is the following total operation over an input value:

1. `null`, booleans, and strings are preserved exactly.
2. A finite number other than negative zero is preserved as a number.
3. `undefined`, `NaN`, positive infinity, negative infinity, negative zero, and bigint use exactly the declared tags. Bigint uses canonical base-10 `BigInt.prototype.toString(10)`.
4. Symbol values, functions, Date, Map, Set, RegExp, Promise, weak collections, ArrayBuffer, SharedArrayBuffer, DataView, typed arrays, class instances, host objects, and every other unsupported value normalize to `{ type: 'opaque' }`.
5. An array becomes a detached dense readonly array of the same length. Each own data index is recursively normalized. A hole becomes `{ type: 'undefined' }`. An accessor index becomes `{ type: 'opaque' }` without invocation. Non-index, non-enumerable, and symbol properties are ignored. Failure of required reflection for the array makes the whole array opaque.
6. An object whose observed prototype is exactly the captured current-realm ordinary Object prototype or `null` becomes `{ type: 'record', entries }`. Own enumerable string data properties are recursively normalized. An own enumerable accessor becomes an opaque value without invocation. Entries are sorted by UTF-16 code-unit key order. Ordinary and null-prototype inputs intentionally normalize equally. Non-enumerable and symbol properties are ignored. Failure of required reflection makes the whole object opaque.
7. A current-realm Error or subclass is recognized only when ordinary prototype traversal reaches the captured `%Error.prototype%` without failure. `name` is the first string data descriptor named `name` found on that chain, otherwise `Error`. `message` is an own string data value, otherwise `''`. Own data properties `code` and `cause` are recursively normalized; accessor-valued `code` or `cause` becomes opaque. Every other field is ignored. `stack` is never read, exported, compared, or fingerprinted. Failure of required reflection makes the whole value opaque.
8. Ancestor detection precedes compound traversal. A reference to any current ancestor becomes `{ type: 'circular' }`. A non-ancestor repeated reference is normalized independently at every occurrence. Alias identity is never retained.
9. No `toJSON`, getter, setter, iterator method, string conversion, user method, Error stack, constructor name, function name, host name, or original object identity is used.
10. There is no dedicated Proxy detector and no Proxy-specific result. A value that presents a non-throwing ordinary reflective shape is normalized according to that observed shape; a required reflective operation that throws or becomes inconsistent makes the value opaque. Velite does not claim hostile-code sandboxing or a system-verifiable Proxy brand.
11. Every output array, tuple, tag, record entry, diagnostic, provenance value, position, path, occurrence, and top-level diagnostic array is detached and recursively runtime immutable before exposure.

This oracle has no implementation-time taxonomy choice. All unsupported categories converge to one opaque value.

### Equality and canonical ordering

`DiagnosticValue` equality is recursive structural equality. A hash may select candidates only when collisions are resolved by complete structural comparison.

The value rank is: `null`, boolean, string, finite number, undefined tag, exceptional-number tag, bigint tag, array, record, error, circular, opaque. Booleans order `false` before `true`. Strings and record keys compare by UTF-16 code unit. Finite numbers compare numerically. Exceptional numbers order `negative-infinity`, `negative-zero`, `nan`, `positive-infinity`. Bigints compare by mathematical integer value. Arrays compare item-by-item then by length. Records compare their sorted entry sequences by key then value. Errors compare `name`, `message`, optional `code`, and optional `cause`, with a missing optional field before a present field. All circular markers compare equal. All opaque markers compare equal.

Path segments compare positionally; numbers compare numerically, strings by UTF-16 code unit, and a number sorts before a string. A strict prefix sorts first. Stable occurrences rank `singleton`, `source-index`, `key`; indexes compare numerically and keys by UTF-16 code unit.

Diagnostic provenance ranks project, collection, source, record. Nested fields compare in written field order. Missing optional fields sort before present fields. Positions compare start then end; points compare line, column, offset with a missing coordinate before a present coordinate. Origin ranks core, prepare-hook, velite; prepare-hook keys compare by UTF-16 code unit.

Canonical diagnostic order is lexicographic by complete provenance, optional position, stage rank, level rank, origin, code, message, optional context, and optional cause. Stage rank is the written `DiagnosticStage` order. Level rank is error, warn, info.

Exact diagnostic identity contains every public field. No hidden root-cause identity, subject key, fingerprint, source locator, call ordinal, completion ordinal, insertion order, or hash may distinguish two publicly equal diagnostics.

### Sole prepare sink

`addDiagnostic()` is the sole prepare diagnostic channel. `PrepareResult.diagnostics` does not exist.

A hook declaration is accepted when ordinary reflection reports an Object-prototype or null-prototype record containing exactly own data properties `key`, `level`, `code`, `message`, and optional `cause`. Unknown string keys, symbol keys, accessors, inherited fields, invalid levels, or empty key/code are malformed. Reflection failure is malformed. No Proxy detector is used; a non-throwing value that presents exactly the accepted ordinary shape is validated by that shape.

The cause is normalized, detached, and snapshotted before `addDiagnostic()` returns. Velite supplies `stage: 'prepare'`, `{ kind: 'prepare-hook', key }`, and project provenance. Exact same-key declarations collapse. Reusing a key with a different normalized payload yields one Velite-authored fatal prepare conflict diagnostic and selects no winner. Reversing call or completion order yields the same set and order.

The sink closes synchronously when the hook return value or Promise settles. A later call throws the documented lifecycle-misuse error synchronously, appends nothing, and cannot affect this or a later build. The hook cannot mutate, replace, remove, reorder, downgrade, or impersonate a core diagnostic. `prepare(false)` records output suppression only and bypasses no fatal, strict, staging, or publication gate.

### Acceptance and cross-ticket effect

Acceptance fails if a supported public type accepts any custom source-range occurrence; if custom effect identity claims a Velite-observed selected input; if any removed host taxonomy remains in `DiagnosticValue`; if a dedicated Proxy detector exists; if normalization retains an original reference or Error stack; if diagnostic equality uses a hidden field; if prepare has another diagnostic channel; if an invalid record retains a sibling effect; or if a uniqueness conflict selects a winner.

Acceptance passes only when source and built declarations expose the complete surface above, runtime own keys agree, an independent test-owned normalizer and comparator reproduce every fixture without candidate-private imports, reversed record/hook completion preserves exact results, recursive mutation cannot alter observations, custom occurrences are limited to `singleton`, `source-index`, and `key`, controlled ranges remain private, and record-atomic plus symmetric uniqueness traces pass.

This resolution supersedes conflicting Ticket 09 diagnostic identity/order wording and narrows Ticket 09 selected-input and source-occurrence provenance to Velite-controlled branches. Ticket 18 and Ticket 25 must use this exact surface and oracle. Ticket 24 receives finalized immutable diagnostics and effects; the `BuilderCoordinator` is the sole strict/publication/lifecycle authority and cannot reopen either transaction.
