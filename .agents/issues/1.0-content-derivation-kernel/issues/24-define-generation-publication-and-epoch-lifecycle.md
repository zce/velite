# Define generation publication and epoch lifecycle

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 05, 06, 09, 19

---

## Question

Which module owns candidate and committed generations, where is the strict policy applied before publication, and how are pipeline epochs, optional processor pools or locks, old requests, manifests, outputs, and teardown coordinated during builds, patches, failed reloads, and successful reloads?

## Review context

The selected transaction semantics require a single publication gate before data, effects, manifests, references, or cleanup become current. The current facade applies strict after `Builder.build()`, and the design does not yet place the committed generation or epoch disposal interface at one explicit factory seam. Close those lifecycle and ownership decisions before implementation slicing.

## Answer

### Selected decision

Velite 1.0 uses one Builder-local, explicitly factory-created **generation publication module** as the sole owner of the current committed generation, recovered previous publication, publication term and fences, physical staging transactions, and post-commit cleanup backlog. `createBuilder()` owns this module's lifecycle and injects its narrow operation capability into every pipeline epoch's Driver. Drivers create complete immutable generation candidates; the Builder coordinates epoch admission and watch events but does not directly mutate generation snapshots. Writers and manifest codecs neither own current state nor decide commitment.

Strict is a durable build/watch operation policy propagated into core. It is evaluated after the Ticket 23 prepare diagnostic transaction has finalized and before output staging or publication. The public facade no longer performs a post-build strict upgrade.

Full builds and owner patches produce the same complete candidate shape and use the same generation transaction. Only one atomic publication seam may make records, effects, diagnostics, logical output, manifests, and output references current. A failed full build, patch, prepare transaction, staging attempt, commit, or shadow-epoch first build leaves the previous successful generation and publication unchanged.

Physical publication uses immutable generation directories plus one atomically replaceable current pointer. Velite-owned asset destinations are content-addressed, so blobs may exist before commitment while references become current only through the data-generation pointer. Stale cleanup is post-commit retryable garbage collection driven only by the old and new committed manifests.

Configuration reload uses a shadow pipeline epoch. The shadow becomes active only when its first full generation has caught up with watch events, passed all gates, staged successfully, and committed. The same publication critical section activates the new epoch and invalidates the old epoch's publication authority. The old epoch then stops admission, drains already admitted work, and disposes.

No public generation registry, epoch manager, publication broker, transaction service, cancellation protocol, processor pool contract, or lifecycle debug interface is added.

### Terminology and generation model

- A **pipeline epoch** is one immutable resolved configuration and its schemas, pipeline, engine, `SessionStore`, content-artifact factory, profile-identity namespace, and any processor pools or processor locks that the implementation actually uses. It is created and disposed as one lifecycle scope.
- A **candidate generation** is a complete immutable snapshot produced by one full or patch operation after local validation, cross-file validation, prepare processing, effect finalization, diagnostic finalization, and canonical ordering, but before publication.
- A **committed generation** is the most recent candidate accepted through the sole publication seam. It is the only in-memory source of current record, effect, diagnostic, and logical-output truth.
- A **published output generation** is the externally visible physical projection of a committed generation: data files and the asset references they make reachable. It may be empty even when the committed internal generation contains records and effects.
- A **recovered publication** is a validated persisted physical generation found at cold start. It supplies previous publication manifests and cleanup ownership, but it is not fabricated into an in-memory committed generation containing records or effects.

The conceptual internal shape is:

```ts
interface Generation {
  readonly id: GenerationId
  readonly epochId: EpochId
  readonly records: ImmutableCollections
  readonly effects: readonly CommittedEffect[]
  readonly diagnostics: readonly ImmutableDiagnostic[]
  readonly logicalOutput: LogicalOutput
  readonly manifests: GenerationManifests
}

interface GenerationManifests {
  readonly data: DataManifest
  readonly assetReferences: AssetReferenceManifest
  readonly publishedFiles: PublishedFileManifest
}

interface GenerationCandidate extends Generation {
  readonly baseGenerationId?: GenerationId
  readonly publication: 'default' | 'empty'
}
```

`DataManifest` maps normalized generation-relative data paths to content digests and file kinds. `AssetReferenceManifest` contains canonical committed reference occurrences, public URLs, and their content-addressed blob identities and digests. `PublishedFileManifest` identifies the Velite-owned data files, sealed generation descriptor, and referenced content-addressed blobs that form the published output generation. It never grants ownership of arbitrary absolute paths.

The generation also contains in-memory-only records, committed effect objects, normalized diagnostics, logical output, source/owner indexes needed to form a later patch, and any immutable publication metadata needed by the next operation. Engine memo entries, parse slots, branch objects, mutable prepare views, temporary files, staging handles, locks, event queues, and cleanup tasks are not generation data.

`GenerationId` and `EpochId` are opaque process-local monotonic identities allocated by each Builder according to epoch creation and operation admission order. Failed attempts may consume identities. They are not persisted, exported, or used as public cache keys. Parallel completion order never determines them. Physical generation directories use a separate opaque collision-resistant `PublicationId`, recorded in the sealed descriptor, because process-local counters are not safe filesystem names across processes.

### Generation owner and the sole commit seam

The generation publication module is Builder-local but Driver-facing:

- `createBuilder()` creates it explicitly and owns its disposal.
- Active and warming Drivers receive a narrow operation capability from it.
- It alone owns `currentCommittedGeneration`, `recoveredPublication`, the current publication term, fence validation, staging transactions, and cleanup backlog.
- The Builder owns active/warming/draining epoch references and the watch journal, but it cannot replace generation state except through the module's commit operation.
- A per-epoch `RunContext` may hold operation-local candidate construction state, but it is not a second owner of current committed state.
- The output writer plans and stages files only. It cannot mutate current manifests, delete stale output, or decide commitment.
- Manifest helpers encode, decode, and validate sealed descriptors only. A manifest write is not an implicit commit.

This refines the review's “Driver/RunContext generation owner” wording. The owner is located at the Driver composition seam and used by every Driver, but it is created once per Builder rather than once per epoch. Per-epoch ownership would create two competing current generations during reload.

The minimum conceptual internal interface is:

```ts
interface BuildOperationPolicy {
  readonly strict: boolean
}

interface GenerationTransaction {
  stage(candidate: GenerationCandidate): Promise<StagedGeneration>
  commit(staged: StagedGeneration, fence: PublicationFence): Promise<CommittedGeneration>
  abandon(reason: unknown): Promise<void>
}

interface GenerationPublication {
  readonly current: CommittedGeneration | undefined
  begin(input: { readonly epochId: EpochId; readonly baseGenerationId?: GenerationId; readonly policy: BuildOperationPolicy }): GenerationTransaction
}
```

These names are conceptual; the ownership, state transitions, and one-commit rule are mandatory. The implementation must not turn this into a generic transaction manager, registry, container, service locator, or process singleton.

A candidate belongs to exactly one transaction and cannot be reused by multiple commit attempts. `stage()` may be called once; concurrent calls on the same transaction share the same settlement. `commit()` may be called once after successful staging; concurrent calls share the same settlement. An impossible second distinct commit or commit after abandonment is `VeliteError('internal')`. `abandon()` is idempotent, removes or records safe staging residue, and is a no-op after a confirmed commit. A failed or fenced commit makes the transaction terminal and uncommitted.

The publication fence is an opaque one-use capability issued by the Builder-local publication module while holding the Builder publication critical section. It captures Builder identity, epoch identity, publication term, expected base generation, and, in watch mode, the accepted event watermark. The publication module validates all fields immediately before pointer replacement. Epoch activation or Builder terminal transition invalidates older terms. A captured or late capability can never reacquire authority.

### Candidate construction, full builds, and owner patches

Full and incremental operations both return a complete `GenerationCandidate` and call the same `stage()` and `commit()` operations. There are no full-build and patch-specific commitment rules.

A full candidate derives all live owners. A patch candidate starts from the current committed generation identified by `baseGenerationId`, removes the complete old state of every changed or removed owner, installs each changed owner's complete new record and effect candidate only if that owner remains valid, reruns simultaneous cross-file checks, and canonicalizes the complete resulting generation. The transaction verifies that its base is still current before staging and again at commit.

If a changed owner becomes schema-invalid during an otherwise successful non-strict patch, the patch atomically removes that owner's old records and effects and installs no replacement. If any fatal, strict, prepare, staging, fence, or commit failure occurs, none of the owner removals or additions become current. The previous generation remains byte-for-byte and semantically intact.

After any failed incremental candidate, the epoch must either require the next operation to form a full candidate or retain and replay the complete dirty-owner set accumulated since the last successful commit. It may not discard the failed operation's dirtiness and patch only a later event batch.

### Strict, fatal, prepare, and publication gate ordering

The exact operation ordering is:

1. Derive branch outcomes and locally valid record candidates.
2. Finalize record effects and discard every effect of invalid records.
3. Run simultaneous cross-file validation and discard every effect of cross-file-invalid records.
4. Aggregate core diagnostics and form Ticket 23's detached recursively immutable core snapshot.
5. Invoke `prepare` with the mutable candidate collections, immutable core snapshot, and append-only diagnostic sink.
6. Await the hook, close the sink, normalize and freeze hook declarations, merge exact identities, and canonicalize final diagnostics and effects.
7. Form the complete immutable generation candidate, including prepare-transformed logical output and publication mode.
8. Apply the fatal gate: any error-level non-schema diagnostic rejects publication.
9. Apply the strict gate: when operation policy has `strict: true`, any remaining error-level schema diagnostic rejects publication.
10. Stage non-content-addressed data, the sealed descriptor, and all three manifests; verify every required content-addressed blob.
11. Validate the publication fence and expected base generation.
12. Atomically replace the current generation pointer.
13. In the same synchronous, no-`await` critical section, install the committed generation and, for reload, the active epoch tuple and new publication term.
14. Construct the public `BuildResult` from the committed snapshot.
15. Start post-commit stale cleanup from the old and new committed manifests.

Core fatal diagnostics do not skip `prepare`; the hook receives the complete core snapshot and may add further diagnostics before the final gate. `prepare(false)` records suppression intent but cannot bypass either gate. Ticket 23's finalized effects and diagnostics remain immutable throughout publication. Staging or commit failures create a new immutable operation-failure diagnostic set; they do not push into or mutate the candidate arrays.

Strict is a durable Builder policy copied into every full build, manual build, `apply`, initial watch build, watch rebuild, and reload build operation. `builder({ strict })`, one-shot `build()`, and `watch()` all use the same core policy. There is no second facade authority and no per-call Builder override with different semantics.

### `prepare(false)` semantics

On a clean successful operation, `prepare(false)` commits:

- the new internal records;
- finalized effects, including semantic declarations that are not physically published;
- final diagnostics;
- the prepare-transformed logical output; and
- an explicitly empty Velite-owned published output generation.

For the empty published generation, the data manifest, published asset-reference manifest, and user-visible published-file manifest are empty. A sealed internal generation descriptor may still exist in the physical generation directory but is not user output. `BuildResult.output` reflects the committed internal logical output and `BuildResult.written` is `[]`.

Only after the empty generation pointer commits do previous Velite-owned data files and asset references become stale-cleanup candidates. On any fatal, strict, prepare, staging, or commit failure, both the old internal generation and old published output generation remain current.

A prepare throw or rejection becomes a fatal `prepare` diagnostic. A malformed hook diagnostic becomes the fatal system-authored prepare diagnostic defined by Ticket 23. A captured sink called after settlement follows Ticket 23's closed-sink misuse contract, adds nothing, and cannot alter this or a later candidate.

### Physical staging and atomic publication

Non-content-addressed data and generated modules must never be written in place. The physical layout uses immutable generation directories and one live pointer, conceptually:

```text
.velite-generations/<publication-id>/...
.velite -> .velite-generations/<publication-id>
```

The configured data path is the one externally visible pointer. All generation-relative imports, runtime data, and declarations switch through that one entry. A normal JSON manifest cannot be the publication pointer because Node, bundlers, TypeScript, and direct filesystem consumers do not resolve output through that manifest.

Staging begins only after Ticket 23 finalization and the fatal/strict gates. Earlier asset reads, probes, hashes, and optional writes of immutable content-addressed blobs are speculative computation, not staging or publication. The staged directory may contain candidate data files, generated entry modules, declarations, the three manifests, and a sealed descriptor. Temporary paths and non-content-addressed bytes are candidate-owned until pointer replacement.

The minimum runtime capability is an atomic current-pointer replacement, conceptually:

```ts
interface AtomicPublicationFileSystem {
  readPublicationPointer(path: string): Promise<PublicationPointer | undefined>
  replacePublicationPointer(input: { readonly path: string; readonly expected?: PublicationId; readonly target: PublicationId }): Promise<void>
}
```

The semantic contract, not this exact spelling, is mandatory:

- The fully staged target is inside the Velite-owned generation root and on a compatible filesystem.
- Success leaves the live path wholly directed to the target.
- Failure leaves it wholly directed to the expected old target.
- There is no observable unlink-then-link window.
- An adapter with an uncertain underlying result must read back and return one determined outcome.
- The implementation cannot silently fall back to per-file rename or overwrite-in-place.
- A runtime adapter that cannot guarantee this primitive fails during runtime composition or configuration initialization, before candidate writes or old-output deletion.

This is a narrow publication primitive, not a filesystem transaction interface. Platform adapters may use an atomic symlink, junction, directory-entry, or equivalent pointer replacement. The observable all-new-or-all-old result is the contract.

An existing pre-1.0 ordinary directory at the configured live data path cannot be silently converted during a normal commit through a non-atomic delete-and-link sequence. Migration requires an explicit clean or one-time migration step before the first 1.0 publication.

### Content-addressed assets and references

All Velite-owned published asset destinations must have immutable content-addressed physical identity. An effective asset output template must contain an adequate content hash. A collision in which one destination denotes different bytes is a fatal `output` collision diagnostic; first write, completion order, and overwrite are never tie-breakers.

Immutable content-addressed blobs may be written before record validity, strict/fatal gates, or data staging. Their existence does not make a reference current. If the operation fails, they remain unreferenced garbage eligible for later collection. No failed candidate may publish a reference to such a blob.

Fixed non-content-addressed asset destinations are not compatible with the atomic generation contract: overwriting one before data commit corrupts the old generation, while switching data and asset pointers separately exposes a mixed-generation window. Therefore pre-1.0 templates that can map different bytes to the same non-hashed destination must migrate to content-addressed names. This clause refines Ticket 09's staging requirements without changing its distinction between speculative blobs and committed references.

### Manifests, recovery, and stale cleanup

The sealed generation descriptor records a format version, `PublicationId`, output-root fingerprint, and the three normalized relative-path manifests. Absolute caller-controlled deletion paths are not persisted as ownership authority.

Cold start reads only the configured current pointer and its sealed descriptor. It does not scan generation directories and guess the newest target. Recovery validates pointer containment, descriptor version and identity, normalized relative paths, path traversal, output-root ownership, digest shapes, and content-addressed blob identities. A valid descriptor forms a `RecoveredPublishedGeneration` used as previous physical publication state. Records, effects, engine memo state, and `SessionStore` data are not recovered; the first operation remains a full derivation.

A missing pointer means there is no known prior publication. Orphan staging directories are never promoted. A corrupt, missing-target, escaped, or tampered current pointer or descriptor produces a fatal recovery/output diagnostic, performs no publication, and authorizes no cleanup. It cannot cause deletion outside Velite-owned generation and blob roots. This contract covers recovery from already durable filesystem state; it does not promise hardware-level crash durability beyond the adapter's documented flush semantics.

Stale cleanup begins only after successful pointer replacement and in-memory commit. It reads only the old and new committed manifests:

- retired data is removed by deleting a validated old generation directory;
- candidate staging residue is removed only inside validated Velite-owned staging roots;
- asset blobs are eligible when present in the old committed reference set and absent from the new committed reference set, subject to any reader-safety grace period;
- discovery history, attempted writes, directory scans, and failed-candidate manifests are not cleanup authority.

Cleanup is retryable garbage collection, not part of commitment. Failure does not roll back the new pointer, change the committed generation, or report the generation as uncommitted. It produces a non-fatal operation-level `output` diagnostic and a persisted or reconstructible retry backlog. Generation diagnostics remain immutable; public results distinguish committed generation diagnostics from post-commit `operationalDiagnostics`. Logger or reporting failures follow the same truth-preserving rule and cannot alter the committed result.

### Pipeline epoch state machine

The conceptual internal interface is:

```ts
interface PipelineEpoch {
  readonly id: EpochId
  readonly state: 'warming' | 'active' | 'draining' | 'disposed'
  run(operation: BuildOperation): Promise<GenerationCandidate>
  stopAdmission(): void
  drain(): Promise<void>
  dispose(): Promise<void>
}
```

Legal transitions are:

```text
warming -> active
warming -> draining -> disposed
active  -> draining -> disposed
```

`disposed` is terminal. A warming epoch accepts only coordinator-owned initial and catch-up work and has no independent publication authority. An active epoch accepts normal Builder operations. Entering draining synchronously stops admission and invalidates that epoch's publication capability; already admitted work may settle. Disposal waits for drain, closes actual epoch-owned resources, releases engine state, and becomes terminal.

The Builder creates, activates, stops, drains, and disposes epochs. Epoch construction uses explicit factory DI. The epoch owns its config, schemas, pipeline, engine, `SessionStore`, content-artifact factory, profile namespace, and actual processor pools or processor locks. If no pooling or locking implementation exists, no pool/lock factory or lifecycle seam is introduced.

The process-wide `SchemaContextHost` remains solely a propagation-and-lease host. It owns no epoch, generation, engine, pool, manifest, fence, publication state, Builder lifecycle, or cleanup task. A Builder-bound `SchemaRunner` adapter may be injected into epoch composition, while every carrier and lease remains schema-run/record scoped under Tickets 19 and 21.

### Reload, activation, drain, and disposal

Configuration reload proceeds as follows:

1. Keep the old epoch active and its committed generation current.
2. Load and assemble a warming shadow epoch without mutating the active tuple.
3. Establish watch coverage for the shadow root, config, and config dependencies before its snapshot build.
4. Run a full shadow build from a recorded watch-event watermark.
5. Replay relevant events after that watermark and rebuild until the candidate is caught up.
6. If another relevant config event invalidates the warming configuration, abandon and dispose that shadow and start again from the latest configuration.
7. Complete prepare finalization, fatal/strict policy, and staging while the old epoch remains active.
8. Acquire the publication critical section, capture a final watermark, replay and validate all events through that watermark, and issue a one-use activation/publication fence.
9. Atomically replace the physical generation pointer.
10. In the same synchronous critical section, install the new committed generation, new active epoch, new publication term, and committed event watermark; transition the old epoch to draining and invalidate its fences.
11. Release the critical section. Later events belong to the new active epoch.
12. Allow already admitted old work to settle without publication, then dispose the old epoch.
13. Run stale cleanup independently after commitment.

The filesystem pointer replacement is the external linearization point. The active-epoch and committed-generation tuple changes immediately afterward without an intervening `await`, while the publication critical section excludes Builder observers. Thus reload generation commit and epoch activation are one logical linearized transition.

A failed config load, shadow initialization, first build, prepare transaction, policy gate, staging attempt, catch-up replay, or pointer commit leaves the old active epoch and committed generation unchanged. The failed shadow enters draining and then disposed.

### Publication fencing and late operations

At commit, the fence must prove:

- the Builder is still open for this admitted operation;
- the candidate belongs to the epoch named by the fence;
- that epoch still has the expected publication term;
- the expected base generation remains current;
- the fence has not been consumed or invalidated; and
- in watch mode, the candidate includes every event through the fence watermark.

After a successful reload swap, old operations may finish parsing, branches, engine computations, prepare code, asset computation, or staging cleanup for existing waiters, but they cannot publish. A stale operation receives a deterministic internal control outcome such as `superseded`, calls idempotent `abandon()`, and is not reported as internal corruption. A manual public build that becomes stale may be retried against the current epoch while the Builder remains open; watch/apply work is represented by event replay and can be ignored after abandonment.

Impossible double commit, invalid state transitions, an implementation-owned use after terminal disposal, or a fence accepted for the wrong Builder/epoch/base is `VeliteError('internal')`. Ordinary stale completion, supersession, or fence rejection caused by a legitimate reload is not.

Late settlement cannot reinstall engine memo dependencies, append diagnostics or effects, reopen a prepare sink, stage into a later transaction, alter cleanup state, or obtain a new fence through a captured reference. Epoch/engine implementations must validate their lifecycle token after asynchronous computation and before every mutable memo or dependency installation.

### Watch event ownership and replay

Raw watch events belong to a Builder-level watch journal, not to the watcher or epoch that observed them. Each callback receives a monotonic sequence number. Path classification occurs when an event is replayed into a target epoch, because roots and config dependencies differ across epochs.

Watch mode establishes a ready subscription before its initial filesystem snapshot and build. This removes the current build-before-subscribe gap. During reload, old and candidate path/config coverage overlap until the swap. The shadow records a snapshot watermark, replays later events, and tracks its own cursor. Under the final publication critical section it processes every relevant event through watermark `H`; events after `H` go to the newly active epoch.

Duplicate replay is acceptable when event application is idempotent; event loss is not. Config and content event order is preserved where semantically relevant. A batch containing config reload must not first mutate an old engine with content events and then discard that relation. A config event relevant to the warming epoch invalidates that shadow candidate.

The watcher port must expose readiness and awaitable close semantics, and the scheduler must expose stop-admission and drain/close semantics. Closing a watch handle waits for its running callback and underlying watcher close. Each handle has an identity; an old handle cannot close a newer watch generation. Scheduler errors and `onRebuild` errors enter a defined watch diagnostic path rather than becoming unhandled rejections.

### Builder lifecycle, concurrency, and cancellation

Builder states are:

```text
open -> disposing -> disposed
```

The first `dispose()` synchronously stops new Builder and watch-event admission and stores one settlement Promise. Concurrent and later calls return that same Promise. Disposal closes its current watch generation, drains admitted scheduler work, waits for active and already draining epochs, closes actual epoch-owned pools/locks, waits for any currently running cleanup attempt, and enters terminal `disposed`. It need not make every deferred garbage-collection retry succeed; safe residue may remain for a future Builder.

Operations admitted before Builder disposal may complete and publish while the Builder drains; disposal waits for them. Operations submitted after disposal begins deterministically fail and cannot reload a session or recreate an epoch. This differs from epoch replacement, where the old epoch loses publication authority at the successful swap even though its admitted work still settles.

There is no new public cancellation protocol. The currently unused `BuildOptions.signal` is removed before 1.0 rather than promising cancellation that Zod, Unified, shared parse work, and arbitrary plugin Promises cannot provide. Started work settles naturally, and leases, lifecycle tokens, and fences prevent late commitment. A user Promise that never settles may therefore make drain and disposal wait indefinitely; Velite does not claim both hard cancellation and complete drain.

Nested and parallel Builders have separate epoch identities, generation identities, engines, `SessionStore` instances, publication modules, fences, journals, candidates, and cleanup state. Disposing or reloading one cannot affect another's state or process-wide host carrier. Concurrent writers deliberately targeting the same physical output root are unsupported unless a runtime adapter supplies an explicit cross-writer publication exclusion contract; no process-wide generation registry or hidden in-memory lock is introduced to pretend to solve cross-process coordination.

### Build results and failure behavior

`BuildResult` is constructed only after a successful commit. It is a public immutable projection or detached copy of the committed generation's logical output and diagnostics, not a reference to the internal `Generation` object. It exposes no generation ID, epoch ID, fence, transaction, pointer, staging path, or internal manifest type. Post-commit cleanup/reporting failures are returned separately as `operationalDiagnostics` so they cannot mutate generation diagnostics or make the committed generation appear uncommitted.

When publication is rejected, the public build/watch boundary constructs `VeliteError` only after the core operation has deterministically refused publication. Its diagnostics are the completed prepare transaction's immutable diagnostics plus any newly normalized asset/staging/commit failure diagnostics. User content, schema, plugin, custom declaration, and prepare problems remain diagnostic data rather than arbitrary internal throws.

Failure rules are:

- Non-strict schema-invalid records are omitted, their effects are discarded, and remaining valid records may form a successful generation.
- Strict schema errors preserve the complete diagnostic set, reject publication, and become `VeliteError('schema')` at the public boundary.
- Core fatal diagnostics reject before staging.
- Prepare throw/rejection and malformed hook diagnostics are fatal `prepare` diagnostics.
- Missing/unreadable required assets are fatal `asset` diagnostics.
- Required probe failures retain the Ticket 09 field/schema classification.
- Data, asset-blob, descriptor, or manifest staging failures are fatal `output` diagnostics and leave current state unchanged.
- A failed atomic pointer operation leaves the old pointer and current generation unchanged.
- A confirmed pointer success is committed truth; later cleanup, logger, or reporting failure cannot roll it back.
- Failed full builds, patches, and reloads leave the previous generation and publication intact.
- Staging residue is either removed by idempotent abandonment or retained as unreferenced Velite-owned garbage.
- Corrupt persisted ownership data authorizes no deletion.
- Unsupported atomic publication capability fails before partial publication work.

### Public and internal interface consequences

Public changes required by this decision are:

- `BuildEntryOptions.strict` becomes the durable Builder policy used by all operations.
- The durable `builder()` facade carries that policy into its internal Builder.
- `BuildOptions.signal` is removed because it has no implemented or supportable hard-cancellation contract.
- `BuildResult` continues to expose committed logical output, committed generation diagnostics, and user-visible writes; it additionally distinguishes post-commit `operationalDiagnostics` when cleanup or reporting fails.
- Watch close remains awaitable and now has terminal drain semantics.

Internal changes include an explicit generation publication factory, full-candidate Driver output, publication policy input, atomic-publication filesystem capability, sealed manifest codecs, epoch lifecycle interface, watch journal/watermarks, and lifecycle tokens for late settlement. `BuildEntryOptions`, Builder defaults, and internal `BuildOperation` must propagate strict to every operation. Driver no longer mutates current manifests or performs stale deletion directly. Writer becomes a staging writer. Watcher and scheduler ports gain readiness/drain/close behavior.

The following remain internal and absent from root declarations, runtime exports, export maps, and reflection: `Generation`, candidate/committed/recovered generation types, IDs, manifests used as ownership authority, transactions, staged generations, publication policies, pointers, descriptors, fences, epoch types, event journals, watermarks, cleanup backlogs, lifecycle tokens, and lifecycle coordinators.

### Alternatives rejected

1. **Facade post-build strict.** It is too late: the current Driver may already have written files, updated in-memory manifests, persisted the manifest, and removed stale output.
2. **Core pre-publication strict.** Selected because one policy applies identically to full, patch, initial watch, watch rebuild, and reload.
3. **Each Driver/RunContext directly owns committed generation.** Rejected because active and shadow epochs would hold competing current state during reload.
4. **Builder fields directly own and mutate generation state.** Rejected because it would spread commit rules through build, apply, reload, and watch call sites rather than deepen one module.
5. **Builder-local factory-owned Driver-facing publication module.** Selected as the one owner across epochs.
6. **Writer or manifest writer implicitly commits.** Rejected because neither understands finalized effects, strict, prepare suppression, epoch activation, or watch watermarks.
7. **Separate data, effect, asset-reference, and output-manifest commits.** Rejected because readers could observe cross-generation combinations.
8. **One complete Generation snapshot.** Selected because it makes last-successful replacement and owner-patch rollback executable.
9. **Overwrite final files and then write a manifest.** Rejected because consumers read final files directly and can observe partial state.
10. **Per-file temporary rename as “sufficiently atomic.”** Rejected because many atomic file renames are not one atomic generation rename.
11. **Staging directory plus one atomic current pointer.** Selected as the minimum honest publication model.
12. **Independent data and asset pointer swaps.** Rejected because two linearization points expose mixed references; content-addressed blobs plus one data pointer avoid this.
13. **Different full and patch publication paths.** Rejected because they would diverge on failure, strict, and stale cleanup.
14. **One transaction for full and patch.** Selected.
15. **Make a reload epoch active before its first build.** Rejected because config or first-build failure would discard a working old epoch.
16. **Shadow epoch activated only after successful first commit.** Selected.
17. **Immediately dispose the old epoch at swap.** Rejected because admitted asynchronous work still needs deterministic settlement and cleanup.
18. **Stop admission, invalidate publication, drain, then dispose.** Selected.
19. **Allow old operations to publish after swap.** Rejected because they can overwrite the new generation.
20. **Let old operations settle under a revoked fence.** Selected.
21. **Process-wide processor pools, locks, or generation registry.** Rejected because they cross Builder/epoch ownership and become hidden singleton coordination.
22. **Epoch-owned optional processor pools/locks.** Selected only when a real implementation needs them; no hypothetical seam is added.
23. **Public hard cancellation.** Rejected because arbitrary plugins and shared work cannot honor it consistently.
24. **Internal settle-and-ignore/abandon.** Selected, with lifecycle tokens preventing late mutation.
25. **Pre-publication stale cleanup or cleanup within rollback.** Rejected because it can damage the previous committed generation.
26. **Post-publication retryable cleanup.** Selected.
27. **Global generation registry or generic transaction manager.** Rejected as hidden mutable state and a shallow interface.
28. **Explicit Builder-local factory-owned publication and epoch modules.** Selected because dependencies and lifecycle remain visible at the composition root.

### Migration consequences

Ticket 18 must add the following 1.0 migration guidance:

- `strict` now rejects in core before publication and applies to initial and subsequent watch builds, manual Builder builds, patches, and reloads.
- A strict failure writes no new data, publishes no new references, and removes no old output.
- `prepare(false)` commits new internal state plus an empty Velite-owned published generation only after all fatal/strict gates pass.
- Failed rebuilds and reloads continue serving the last successful generation.
- Existing ordinary data output directories require an explicit clean or one-time migration before generation-pointer publication.
- Velite-owned asset templates must produce content-addressed destinations; non-hashed fixed destinations must migrate.
- `BuildOptions.signal` is removed rather than upgraded into an unsupported cancellation promise.
- Prepare may execute for a shadow candidate that later becomes stale; hook-owned external side effects remain outside rollback.
- Corrupt current publication metadata requires explicit repair/clean and never authorizes broad deletion.
- Post-commit operational diagnostics are distinct from committed generation diagnostics.

### Architecture and documentation updates required during implementation

Do not edit knowledge files in this decision ticket. Implementation/spec work must update:

- `.agents/knowledge/module-architecture.md`: name the Builder-local generation publication module and epoch lifecycle factories as explicit composition-owned modules; record the sole commit seam; prohibit writer/facade/manifest ownership, generic transaction managers, global generation registries, and hidden singleton locks.
- `.agents/knowledge/schema-context.md`: state that the process-wide host only propagates leased schema runs and owns no generation, epoch, publication, pool, `SessionStore`, or Builder lifecycle; record epoch/record ownership separation.
- `.agents/knowledge/error-handling.md`: define pre-publication fatal/strict rejection, prepare/staging/commit diagnostic conversion, ordinary superseded-operation abandonment versus internal invariant failure, post-commit operational diagnostics, and the rule that confirmed publication cannot be reported as uncommitted.
- Generation/publication documentation: define terminology, complete Generation contents, full/patch transaction equivalence, staging layout, the atomic pointer port, sealed recovery descriptors, and BuildResult construction.
- Output/asset documentation: distinguish prewritten content-addressed residue from committed references, require immutable asset destinations, and define output collision behavior.
- Watch/lifecycle documentation: define shadow reload, event journal/watermarks, activation tuple, fencing, stop-admit/drain/dispose, terminal Builder behavior, and absence of public hard cancellation.
- Migration documentation: include every public and physical-layout consequence listed above.

Responsibility remains local:

- Public facade: assemble default runtime, set durable options, convert rejected operation diagnostics to `VeliteError`, and dispose one-shot Builders.
- Builder: own admission, epochs, watch journal, and publication-module lifetime.
- Driver: derive and finalize complete candidates and invoke the publication seam.
- Publication module: stage, fence, atomically commit, recover previous publication, and schedule cleanup.
- Writer: pure planning plus candidate-directory staging only.
- Watch loop: journal raw events and drive replay; it never owns generation commitment.

### Test oracle and acceptance tests

The implementation must provide deterministic adapter and integration tests for all of the following:

1. A strict schema error writes no new data, descriptor, manifest, or asset reference and deletes no old output.
2. A non-strict schema error excludes invalid records and can commit the remaining valid generation.
3. A core fatal diagnostic rejects before staging and publication.
4. A Ticket 23 hook fatal or malformed hook diagnostic rejects publication.
5. `prepare(false)` still completes fatal and strict gates.
6. Clean `prepare(false)` commits a new internal generation and an empty published output generation.
7. A successful full build atomically replaces records, effects, diagnostics, logical output, and all manifests.
8. A successful patch calls the same transaction and sole commit seam as a full build.
9. A failed patch preserves all old owners, effects, data, references, and manifests.
10. A changed owner becoming invalid is removed only by a successful non-strict patch.
11. Data or generated-module staging failure does not change the current generation or pointer.
12. Descriptor, manifest, or atomic pointer failure preserves the old generation and publication.
13. Staged residue never becomes current and cannot be recovered as the latest generation.
14. A prewritten content-addressed blob remains unreferenced after a failed operation.
15. Stale cleanup starts only after the pointer commit counter.
16. Cleanup decisions use only validated old and new committed manifests.
17. Cleanup failure does not roll back or misreport the new committed generation and creates retryable operational diagnostics.
18. Cold start validates the current pointer and sealed descriptor and recovers previous physical publication ownership.
19. Corrupt, escaped, or tampered descriptors cannot authorize out-of-root deletion or speculative publication.
20. Failed config loading retains the old epoch and generation.
21. A shadow epoch first-build failure does not swap active epoch or publication.
22. Successful reload commits the new generation and active tuple before old stop-admit/drain/dispose and cleanup.
23. An old epoch cannot admit a new operation after the swap.
24. An old in-flight operation may settle, but its fence is rejected and its transaction is abandoned.
25. Old operation completion order cannot overwrite the new generation or change canonical identity/order.
26. Events arriving during warming, catch-up, and the final fence are not lost and are processed by a deterministic epoch.
27. Builder disposal stops admission, closes its watch generation, waits for required drain, and reaches terminal state.
28. Concurrent Builder/epoch/watch disposal is idempotent and shares one settlement per object.
29. Build, apply, watch, clean, broker demand, schema lease, pool use, and publication attempted after their terminal boundary fail deterministically.
30. Captured broker, schema, pool, sink, engine, and publication capabilities cannot revive an old epoch or later generation.
31. Two parallel Builders with distinct output roots share no generation, epoch, fence, journal, engine, `SessionStore`, or optional pool state.
32. The process-wide `SchemaContextHost` owns and leaks no generation or epoch state across nested or parallel Builders.
33. When a processor pool or lock implementation exists, it is strictly epoch-owned, drains, and closes once at epoch disposal.
34. When no pool implementation exists, declarations and runtime composition contain no meaningless pool seam.
35. Successful `BuildResult` diagnostics come from the committed prepare-finalized snapshot; rejected `VeliteError` diagnostics come from the completed prepare transaction plus immutable operation-failure diagnostics.
36. Diagnostic/effect identity and canonical order are unchanged by record, branch, hook, staging, or old/new epoch completion order.
37. Logger, reporting, and post-commit cleanup failures do not alter the confirmed pointer or committed-generation truth.
38. Full, incremental, and reload builds for the same final input produce equivalent committed records, effects, diagnostics, logical output, and manifest semantics.
39. Root exports, built declarations, export maps, runtime exports, and reflection expose no generation, epoch, transaction, pointer, fence, journal, lifecycle token, or cleanup internals.
40. Ticket 25 can observe parse/branch work plus generation `candidate`, `stage`, `commit`, `abandon`, pointer swap, cleanup, epoch create/warm/swap/stop-admit/drain/dispose, replay, and late-settlement counters without observing private object identity.

Additional state-machine tests must prove that watcher readiness closes the initial snapshot gap, changed root/config dependencies receive overlapping coverage, an old watch handle cannot close a new watch generation, scheduler close awaits a running callback, a failed patch retains accumulated dirtiness, engine late settlement cannot reinsert memo state after disposal, and adapter capability failure occurs before any partial write.

### Superseded clauses

This answer supersedes or narrows the following existing wording:

- Ticket 09's statement that “the facade policy remains the authority” for strict is superseded. Core operation policy is the authority, and the facade only converts an already rejected operation into `VeliteError`.
- Ticket 09's generic allowance for non-content-addressed staging is narrowed for published assets: Velite-owned asset destinations must be content-addressed because data and asset roots cannot be independently switched atomically.
- Ticket 09's reference to atomically replacing “data/effects/reference manifests” is fixed as one complete Generation snapshot plus one physical generation-pointer commit.
- Ticket 09's cleanup and `prepare(false)` semantics remain valid but are made executable through committed old/new manifests and an explicit empty published generation.
- Ticket 21's epoch-disposal deferral is resolved by the warming/active/draining/disposed state machine; process-host lifetime remains separate.
- Ticket 23's statement that Ticket 24 receives an immutable candidate is preserved and strengthened: publication never reopens mutable diagnostic/effect arrays, and staging failures create a separate immutable failure result.

### Effects on related tickets

- **Ticket 05:** the Content Artifact Broker remains record-scoped and outside generation/publication state. No cross-record or cross-generation cache is added.
- **Ticket 06:** ordinary plugin semantics remain unchanged. Processor pooling and locking stay unobservable and epoch-owned only if implemented; arbitrary plugin work is not hard-cancelled.
- **Ticket 09:** last-successful generation, declarative effects, `prepare(false)`, and post-commit cleanup remain in force. Facade strict authority is superseded, and asset publication is narrowed to content-addressed destinations.
- **Ticket 18:** remains unresolved and now also depends on this ticket. It must incorporate strict, empty publication, failed rebuild/reload, physical-layout, asset-template, cancellation-removal, recovery, and operational-diagnostic migration guidance.
- **Ticket 19:** the private content capability and leased schema-run separation are preserved. No generation, publication, epoch, or diagnostic registry enters `SchemaContext`.
- **Ticket 21:** the process-wide host remains process-owned and non-disposable; Builder and epoch lifecycle state remains independent. The internal root `createBuilder` removal and explicit `SchemaRunner` injection remain required.
- **Ticket 22:** pristine artifacts, VFile seeds, branch objects, and profile namespaces remain epoch/record scoped. Epoch disposal and lifecycle tokens prevent late reinsertion or reuse.
- **Ticket 23:** finalized effects and recursively immutable diagnostics flow unchanged into the candidate. Prepare suppression becomes candidate publication mode, and no second sink or mutable array is introduced.
- **Ticket 25:** now depends on this ticket's executable structural counters and lifecycle boundaries. It must measure generation candidate/stage/commit/abandon, pointer publication, cleanup, epoch swap/drain/dispose, replay, and retained-state behavior in addition to content derivation counters.
- **Ticket 11:** remains blocked. Final approval must inspect the publication filesystem contract, content-addressed asset migration, sole generation owner, strict gate, full/patch equivalence, shadow reload and watch replay, terminal disposal, private-export tests, and Ticket 25's structural evidence before implementation planning.

No product code or current knowledge file is changed by this decision.

## Reopened by final approval review

Ticket 11 found three unresolved lifecycle oracles. Define whether the first cleanup attempt is awaited before returning an immutable `BuildResult` so `operationalDiagnostics` can report its failure, define reader-safe retirement of old generation directories and blobs, and state explicitly that an operation admitted before Builder disposal retains publication authority while disposal rejects only new admission and waits for the admitted operation.

## Final lifecycle oracle resolution

### Scope and supersession

This resolution closes only the three lifecycle gaps recorded by Ticket 11. It does not reopen the Builder-local generation owner, sole commit seam, strict timing, complete full/patch candidate equivalence, shadow-epoch activation, publication fence, atomic pointer, content-addressed asset, watch journal, terminal disposal, or Ticket 23 immutable diagnostic architecture.

The following earlier clauses are superseded where they conflict with this resolution:

- Steps 14 and 15 under **Strict, fatal, prepare, and publication gate ordering** are replaced by the complete post-commit sequence below. A `BuildResult` is not constructed before the first cleanup attempt.
- A Builder terminal transition no longer invalidates publication authority already granted by operation admission. Earlier references to a Builder terminal transition invalidating every older publication term apply only to non-admitted future work.
- The fence condition that the Builder "is still open" is replaced by proof that the committing operation was admitted while the Builder was open and has not lost authority for an independent epoch, base-generation, watermark, or fence reason.
- Entering an epoch's `draining` state still revokes that epoch's authority during epoch supersession. It does not describe Builder disposal, which preserves the authority of operations admitted before disposal.
- "Run stale cleanup independently after commitment" now means that later retries are independent. The first post-commit cleanup attempt is awaited as part of the committing operation.
- The unspecified asset-reader "grace period" is replaced by the exact Builder-local lease and one-predecessor retention contract below. Wall-clock delay is not retirement authority.
- The earlier disposal wait for a "currently running cleanup attempt" is strengthened to the exact admitted-operation, active-attempt, epoch, and managed-reader wait set below.

All non-conflicting earlier clauses remain in force. In particular, confirmed atomic pointer success is committed truth and cannot be rolled back or reclassified by cleanup, logging, reporting, result construction, or later disposal.

### Complete commit, cleanup, and result sequence

One successful full, patch, initial-watch, rebuild, or reload operation has this exact post-staging sequence:

1. Validate the expected base generation, event watermark when applicable, publication fence, staged descriptor, and staged manifests.
2. Atomically replace the configured current pointer. This filesystem pointer replacement is the external commit linearization point.
3. Without an intervening `await`, install the committed in-memory generation. For a successful reload, install the active epoch tuple and new publication term, record the committed watermark, and move the old epoch to `draining` in the same publication critical section.
4. Release the publication critical section. The successful operation is now irrevocably committed even if every following step fails.
5. Form one finite cleanup-attempt plan from the validated protected-manifest set, the newly retired manifests, and any validated retry backlog. The plan is snapshotted before execution, canonically ordered by persisted publication identity, cleanup kind, and normalized relative path, and never ordered by task insertion, Promise settlement, object identity, or directory enumeration.
6. Await exactly one first cleanup attempt over that finite plan. Each selected item reaches one terminal attempt outcome before the attempt settles. No newly discovered or concurrently enqueued item joins this attempt.
7. Normalize first-attempt cleanup outcomes and any post-commit logger or reporting failures observed before the snapshot into a fresh recursively immutable `readonly Diagnostic[]` named `operationalDiagnostics`.
8. Construct a detached recursively immutable `BuildResult` from the already committed generation, committed writes, and the operational snapshot.
9. Return that `BuildResult`. Returning it performs no I/O, invokes no user callback, and requires no serialization.

The first cleanup attempt is therefore awaited, not background work and not a public handle. It delays normal completion only until every item in its finite plan has a terminal attempt outcome. It does not wait for the retry backlog to become empty.

The core must not implement cleanup timeout by racing an uncancellable filesystem Promise and returning while that Promise may still delete data. A cleanup adapter may report `timeout` only after the attempted mutation has settled or cancellation has been confirmed and no hidden mutation remains active. An adapter that cannot provide that guarantee awaits the underlying operation and does not synthesize a timeout. The finite manifest-derived plan bounds first-attempt work without making wall-clock scheduling, timer winner order, or best-effort cancellation a public oracle.

Build-result construction is a total projection over already normalized immutable values. Velite performs no post-commit result serialization. A violated internal construction invariant may be reported as a committed internal operational failure, but it must never be surfaced as evidence that the confirmed pointer did not commit.

### Cleanup outcomes and operational diagnostics

For each planned cleanup item, the terminal outcome is exactly one of:

- `deleted`: the validated target was removed;
- `absent`: the validated target was already absent and the item is complete;
- `failed`: no further hidden mutation remains active and the item stays in the retry backlog with its normalized failure;
- `timeout`: the adapter has confirmed terminal timeout or cancellation, no hidden mutation remains active, and the item stays in the retry backlog; or
- `partially-deleted`: a validated generation or trash target was only partly removed, no hidden mutation remains active, and the same manifest-authorized item stays in the retry backlog for idempotent completion.

Successful and absent items leave the backlog. Failed, timed-out, and partially deleted items remain. Successful deletion of one item is not rolled back because a sibling item failed. Cleanup failure, timeout, or partial deletion adds a non-fatal Velite-authored `output` operational diagnostic with project provenance, stable cleanup code, persisted publication identity, normalized relative subject, terminal outcome, and normalized cause when present. Exact duplicates may collapse under Ticket 23's diagnostic oracle; Promise completion and attempt order do not affect identity or canonical order.

`BuildResult.diagnostics` is the committed generation's prepare-finalized immutable diagnostic snapshot. `BuildResult.operationalDiagnostics` is a distinct immutable snapshot of post-commit operational facts observed by this operation before result construction. Neither array aliases candidate, logger, backlog, or later-operation state.

A later retry never mutates an earlier `BuildResult`. A retry admitted by a later operation contributes its new outcomes to that later operation's `operationalDiagnostics`. A retry run by the private Builder-local reporting path emits a new immutable operational report through that path. No mutable array, live cleanup handle, or retained result reference is used as a reporting channel.

Cleanup, logger, and Velite-owned reporting failures use the same top-level operational channel but distinct stable codes and normalized contexts. A cleanup failure describes retirement work. A logger failure describes failure to present an already known fact. A reporting-path failure describes failure to retain or deliver an operational report. Logging an operational failure is attempted at most once in that reporting cycle; failure of that attempt adds one logger/reporting fact and is not recursively logged through the same failing sink. A logger or callback failure observed after a result snapshot belongs to a later private operational report, not to the returned result.

Cleanup success produces no required diagnostic. Cleanup failure never changes committed diagnostics, `written`, logical output, current pointer, current generation, or operation success. If required acceptance evidence itself cannot be retained, the evidence run is invalid as Ticket 25 specifies; the product generation remains committed.

### Reader and protected-publication model

A **managed reader** is a Velite-owned in-process consumer that acquires a generation snapshot through the private Builder-local publication seam before reading generation-backed files. Arbitrary user code, a direct filesystem consumer, another process, a bundler process not using that seam, and a reader that merely received a path are **external readers** and do not participate in Builder-local pin accounting.

A **reader lease** is a Builder-local, opaque, private, idempotently releasable capability that pins exactly one sealed published generation. It protects:

- that generation directory;
- its sealed descriptor;
- every data file named by its validated data and published-file manifests; and
- every content-addressed asset blob named by its validated asset-reference manifest.

Lease acquisition is linearized by the publication module with pointer/current-generation observation. A racing acquisition receives and pins either the complete old generation or the complete new generation; it cannot receive a mixed set. The lease records persisted `PublicationId` and validated manifest values, not JavaScript object identity. Release removes that pin exactly once. A captured path without a live lease has no managed-reader authority.

New managed-reader admission stops when Builder disposal begins. Existing reader leases remain valid until release. An abandoned or never-released lease blocks retirement of its pinned generation and referenced blobs and prevents Builder disposal from reaching `disposed`. Velite does not expire an in-process lease by wall clock, infer reader death from inactivity, or revoke it to make cleanup progress.

### External-reader support boundary

Velite 1.0 does not claim that an unobservable external process participates in an in-memory reference count. Instead, physical publication retains exactly the current generation and its direct committed predecessor as the mandatory external-reader window.

An external reader obtains a supported snapshot by atomically resolving the configured current pointer to a sealed `PublicationId` and reading only paths validated by that generation's descriptor. If it resolves generation `G` while `G` is current, Velite guarantees that `G` remains physically retained while the pointer advances successfully at most once. After the second successful pointer advance following that observation, `G` may be retired and the reader must resolve a new snapshot. This is a generation-count contract, not a duration or grace-period contract.

The guarantee covers generation directories, descriptors, data files, and referenced blobs for that one-successor window. It does not promise safety for a reader that outlives two successful commits, caches a generation path indefinitely, reads an unvalidated path, or expects an already opened filesystem handle to survive deletion according to platform-specific behavior. Such behavior is outside the supported contract rather than best-effort public semantics.

A stronger cross-process or indefinite guarantee would require a separately designed persisted lease protocol. Velite 1.0 exposes no such protocol, public generation handle, external reader registry, or wall-clock lease.

### Retirement eligibility

The **protected manifest set** consists of:

- the current committed generation manifest;
- the direct predecessor retained for the external-reader window; and
- every validated manifest pinned by a live managed-reader lease, including older generations.

A sealed generation directory and all data files inside it become retirement-eligible only when all of these are true:

1. It is not current.
2. It is not the direct retained predecessor.
3. No live managed-reader lease pins it.
4. Its sealed descriptor and normalized relative manifests validate against the configured Velite-owned roots.
5. A committed successor descriptor or validated persisted cleanup backlog explicitly identifies it as retired.

A content-addressed blob becomes retirement-eligible only when all of these are true:

1. No manifest in the complete protected manifest set references its blob identity and digest.
2. The blob identity and relative path validate under the configured Velite-owned blob root.
3. A validated committed manifest transition or persisted cleanup backlog explicitly authorizes considering that blob.

The blob rule is reference-set based. A blob referenced by the current generation, the retained predecessor, or any live-pinned older generation cannot be deleted. Equal source paths, one old/new manifest comparison, physical file presence, discovery history, or one generation's retirement are insufficient authority.

Generation retirement may atomically rename one eligible validated directory into a Builder-owned trash location before recursive deletion. The rename is an implementation option for making partial deletion and retry local; it grants no new ownership. The sealed descriptor remains available until terminal deletion where the chosen adapter requires it. A partial delete retains its original validated backlog entry. Cleanup never scans generation, staging, trash, or blob directories to guess ownership and never promotes an orphan by recency.

### Crash, residue, and cold start

A process crash ends all process-local managed readers and loses their in-memory pins. Velite does not persist or reconstruct those pins and therefore makes no post-crash promise for a reader that existed only in the crashed process. An independent external process retains only the one-predecessor guarantee above.

Each sealed current descriptor records enough normalized committed metadata to validate the direct predecessor and carry forward the manifest-authorized retirement backlog. Cold start reads the configured current pointer and its sealed descriptor, validates the current and predecessor identities and manifests, and reconstructs only the protected predecessor and explicit cleanup backlog reachable from that committed metadata. It does not scan for the newest directory, infer ownership from names, or treat directory presence as a reference.

Crash residue has these outcomes:

- A staged directory never named by a committed descriptor is never promoted. If no validated backlog entry authorizes its deletion, it remains safe residue until explicit clean.
- A validated trash or partially deleted generation named by the committed backlog may be retried idempotently.
- An unreferenced speculative blob may be deleted only when a validated committed manifest transition or backlog identifies it and the complete protected manifest set contains no reference. Unknown blobs remain residue until explicit clean.
- A corrupt, escaped, missing-target, inconsistent, or unverifiable current/predecessor descriptor authorizes no publication and no deletion.
- A crash between pointer commit and the awaited cleanup attempt still leaves committed truth recoverable because the new sealed descriptor carries the predecessor and retirement authority needed for a later retry.

Explicit clean remains the operator assertion that no supported reader requires the configured Velite-owned roots. It is not ordinary cleanup and must retain its separate destructive-operation admission and path-containment checks.

### Operation admission and Builder disposal state machine

The Builder states remain:

```text
open -> disposing -> disposed
```

The Builder-local lifecycle coordinator owns one admission ledger. The unique operation-admission linearization point is the atomic action that verifies `state === 'open'`, assigns the Builder-local operation ordinal and target epoch, and inserts the operation record into that ledger. Method invocation time, Promise creation, queue insertion order outside the coordinator, callback scheduling, and Promise completion are not admission.

The first `dispose()` call uses the same coordinator. Its unique `open -> disposing` linearization point atomically changes the state and closes admission. Concurrent and later `dispose()` calls return the same stored settlement Promise. After that point:

- a new full build, patch, apply, clean, watch generation, reload, managed-reader lease, watch event, scheduler callback, or cleanup retry is not admitted;
- a submitted public operation fails with the documented terminal Builder outcome;
- a raw watch event may be acknowledged and discarded as post-terminal input but cannot recreate a scheduler, epoch, or operation;
- a captured capability cannot register a new operation or obtain authority through a later Builder; and
- persisted cleanup backlog may remain for a future Builder, but no new retry starts in the disposing Builder.

An operation admitted before that transition retains the same publication authority it would have had while the Builder was open. It may continue derive, prepare, asset computation, candidate finalization, stage, acquire a publication fence, validate that fence, atomically commit, install the generation, perform its awaited first cleanup attempt, construct its result, and settle. Disposal does not increment its publication term, revoke an already issued fence, or prevent an admitted operation from receiving a fence later in its normal flow.

At commit, the fence proves the operation's admission record and Builder identity plus the existing epoch, term, expected-base, one-use, and watermark conditions. It does not require the Builder state to remain `open`. If publication and disposal race, their coordinator order decides admission only: an operation admitted first may later commit and disposal waits; disposal linearized first causes the operation to fail admission and it can never commit. Promise settlement order does not decide authority.

An admitted operation does not gain immunity from independent publication rules. It loses authority normally when:

- a successful epoch replacement supersedes its old epoch;
- its expected base generation is stale;
- its watch watermark is incomplete or stale;
- its one-use fence was consumed or independently invalidated; or
- another existing deterministic fence validation fails.

These outcomes are ordinary `superseded`, `stale`, or fenced control results and lead to idempotent abandonment. Builder disposal itself is not an additional revocation reason for an already admitted operation.

An admitted reload may finish warming, catch-up, staging, commit the new generation and active epoch, and then have that epoch drained by the waiting Builder disposal. Conversely, a successful epoch swap revokes old-epoch publication authority even when the old operation was admitted before Builder disposal. Epoch supersession and Builder disposal are separate terminal transitions with separate state-machine events and assertions.

### Disposal wait set and terminal outcomes

Builder disposal reaches `disposing -> disposed` only after all of the following Builder-owned state has settled or closed:

- every operation in the pre-disposal admission ledger, including its derive/prepare/stage/commit or abandon path, awaited first cleanup attempt, and result settlement;
- the current watch generation, watcher close, admitted scheduler callbacks, and admitted event replay;
- every active cleanup attempt or retry admitted before disposal, without requiring the persisted retry backlog to become empty;
- every warming, active, and already draining epoch, including actual epoch-owned pools or locks when present;
- every transaction, fence, engine mutation, `SessionStore`, journal cursor, and epoch lifecycle state owned by those admitted operations; and
- every live Builder-local managed-reader lease.

An admitted operation that fails, becomes stale, or is fenced settles through its normal immutable failure/control result and does not make disposal fail. A cleanup failure leaves safe persisted backlog and does not make disposal report the committed generation as uncommitted. Epoch or resource disposal failure is normalized into the Builder disposal outcome without reopening admission or changing committed truth.

A user plugin Promise that never settles, an adapter operation that never reaches a terminal outcome, or a managed-reader lease that is never released keeps the one shared disposal Promise pending indefinitely. Velite provides no hard cancellation, wall-clock lease expiry, forced publication revocation, or false terminal success to escape that wait. Safe persisted cleanup backlog alone does not block disposal once no cleanup attempt is active.

After `disposed`, every operation other than repeated idempotent disposal or close observation deterministically fails. No operation, watch event, reload, retry, reader lease, epoch, publication fence, or process-host carrier can recreate Builder-owned state.

Parallel Builders have separate lifecycle coordinators, admission ledgers, operation ordinals, publication terms, fences, epochs, reader pins, protected manifest sets, cleanup plans, retry backlogs, and disposal Promises. The process-wide `SchemaContextHost` owns none of them. Disposing, reloading, pinning, cleaning, or retrying in one Builder cannot alter another Builder's authority or wait set.

### Independent state-machine fixtures and acceptance evidence

Implementation acceptance must use independent logical event fixtures and controlled adapters rather than candidate object identity or real-time races. At minimum it must prove:

1. Pointer success precedes synchronous in-memory install, which precedes first cleanup planning and attempt, operational snapshot, result construction, and return.
2. No first cleanup item begins before pointer success, and no result is constructed before every selected item has a terminal attempt outcome.
3. Deleted, absent, failed, terminal-timeout, and partial-deletion outcomes produce the exact backlog and operational-diagnostic effects above.
4. A timeout fixture proves that no delayed filesystem mutation occurs after the timeout outcome or result return.
5. Cleanup sibling failure does not undo successful deletion, commit, committed diagnostics, writes, or logical output.
6. A later retry creates a new report or later result diagnostic and leaves the earlier result recursively unchanged.
7. Cleanup, logger, and reporting failures use distinct codes in one operational channel and cannot recursively report through a failing sink.
8. Result construction and return invoke no user callback or serialization and cannot reclassify confirmed commit.
9. Lease acquisition racing pointer commit pins either the complete old or complete new validated publication, never a mixed generation.
10. A live lease preserves its generation directory, descriptor, data files, and every referenced blob through arbitrary later commits.
11. Releasing the final pin makes an otherwise eligible generation and its uniquely referenced blobs eligible; release is idempotent.
12. Current plus direct predecessor remain protected, and a generation becomes eligible only after the second subsequent successful pointer advance when no lease pins it.
13. An external-reader fixture can complete within one successor commit and is explicitly outside the guarantee after the second.
14. A shared blob remains while referenced by current, predecessor, or any live-pinned generation and is eligible only after the complete protected manifest reference count reaches zero.
15. Cleanup considers only validated committed descriptors, protected manifests, and explicit backlog entries; reversed directory enumeration or injected orphan names changes no decision.
16. Crash-after-pointer-before-cleanup recovers current, predecessor, and backlog from sealed metadata without scanning or promoting staging residue.
17. Corrupt current, predecessor, staging, trash, blob, or backlog metadata authorizes no deletion outside validated roots.
18. Partial generation deletion retries idempotently, while unknown residue remains for explicit clean.
19. The admission-before-dispose interleaving permits the admitted operation to obtain a fence and commit while disposal waits.
20. The dispose-before-admission interleaving rejects the operation before derive, stage, fence, or commit.
21. Disposal does not revoke an admitted operation solely because Builder state is `disposing`.
22. Epoch supersession, stale base, stale watermark, and consumed fence still reject an admitted operation independently of disposal.
23. An admitted reload may activate and publish before the waiting disposal drains its new epoch.
24. Failed, stale, and fenced admitted operations abandon and settle without blocking disposal beyond their settlement.
25. Concurrent disposal calls share one settlement and one state transition.
26. A never-settling admitted operation, non-terminal adapter call, and never-released reader lease each keep disposal pending; no timeout or forced revoke is fabricated.
27. Persisted cleanup backlog with no active attempt does not prevent terminal disposal.
28. Disposed Builders reject operations, watch events, reloads, retries, clean, and reader acquisition and cannot recreate epochs or publication authority.
29. Parallel Builders share no admission, fence, epoch, pin, protected-manifest, cleanup, or disposal state.
30. Root exports, declarations, export maps, runtime reflection, and external package paths expose no generation registry, reader registry, lease protocol, cleanup handle, transaction service, publication broker, lifecycle coordinator, instrumentation service, or service locator.

Ticket 25's structural event vocabulary must distinguish cleanup plan, first-attempt start/terminal settlement, per-outcome counts, immutable operational snapshot, later retry, reader acquire/release/pin-blocked retirement, predecessor retention, admission, disposal transition, and epoch supersession. Harness-assigned publication and operation labels are persisted logical labels, never object addresses or Promise order.

### Ticket 25 timed-region consequence

Every timed `build()` or `apply()` interval ends only after its awaited first cleanup attempt, immutable operational snapshot, `BuildResult` construction, and return. Therefore:

- the 100-document cold full interval includes its first cleanup attempt and still includes terminal Builder disposal as already specified;
- the 1,000-document mixed full interval includes the full operation's first cleanup attempt before that interval stops;
- the no-op interval includes its normally empty or manifest-determined first attempt and result construction;
- the single-file incremental interval includes its first cleanup attempt and result construction; and
- later retry work not admitted into one of those operations is excluded from that operation's timer and measured separately, while disposal waits only for retry attempts already active or admitted before disposal.

Cleanup counters and timers must describe the same region. A report may not count first-attempt work as part of an operation while excluding its time, or include later retry time while attributing only first-attempt counters. The finite plan and terminal adapter fixtures make this executable without wall-clock cleanup authority.

### Migration and cross-ticket handoff

Ticket 18 must carry these additional user-facing consequences without creating compatibility shims:

- a successful operation returns only after one post-commit cleanup attempt, and `operationalDiagnostics` is an immutable snapshot distinct from committed diagnostics;
- cleanup failure, timeout, partial deletion, logger failure, or reporting failure can accompany a successfully committed generation and never means the generation was uncommitted;
- later retries produce later operational reports and never mutate an earlier `BuildResult`;
- Velite-managed in-process readers use a private lease, while direct/external readers receive only the current-plus-one-predecessor generation-count window;
- long-lived external readers must reacquire a snapshot before a second successful pointer advance and receive no wall-clock or indefinite opened-handle guarantee;
- shared asset blobs remain while referenced by any protected committed or pinned manifest;
- crash recovery uses sealed current/predecessor/backlog metadata and leaves unverifiable residue for explicit clean;
- Builder disposal preserves pre-disposal admitted publication authority, rejects only later admission, and may wait indefinitely for a never-settling plugin or never-released managed reader; and
- epoch supersession may still revoke an old admitted operation and must not be described as Builder disposal behavior.

Ticket 25 must carry the timed-region, event, fixture, counter, evidence-retention, and independent-calculation consequences above. Its design approval requires an executable evidence contract; completed implementation measurements remain post-implementation release evidence.

No other resolved ticket must be reopened. Ticket 23's `Diagnostic` model is reused unchanged for both committed and operational immutable snapshots. Ticket 21's process host remains process-owned and owns no reader pin, admission, fence, cleanup, epoch, generation, or disposal state.

The generation publication module remains a deep Builder-local module behind a narrow Driver-facing and managed-reader seam. Generation registries, global reader registries, transaction services, publication brokers, process-wide lifecycle managers, service locators, and public cleanup handles remain absent. No object identity, Promise completion order, cleanup task insertion order, directory enumeration, wall-clock grace period, or best-effort filesystem behavior is a public oracle.

No product code, documentation, examples, tests, benchmark implementation, knowledge file, prototype, report, implementation ticket, implementation spec, or implementation plan was created or changed while resolving this decision.

## Final concept-convergence resolution

### Authority and supersession

This section is the current and complete Ticket 24 contract. Earlier sections remain decision history only. This section supersedes every conflicting reference to a separate generation-publication owner, lifecycle coordinator, admission ledger, publication-fence capability, publication term, watermark authority, protected-manifest registry, managed-reader seam, reader pin, reader-blocked disposal condition, or public committed-but-no-result protocol.

The retained invariants are unchanged: complete immutable candidates, strict and fatal gates before staging, record and cross-file effect finalization, last-successful truth, atomic pointer publication, synchronous logical install, crash recovery, current-plus-direct-predecessor external-reader safety, shared-blob protection, one finite awaited first cleanup attempt, retryable cleanup backlog, late-settlement fencing, epoch supersession, Builder disposal, and parallel Builder isolation.

### Final domain vocabulary

- A **pipeline epoch** owns one resolved configuration and its schemas, pipeline, engine, `SessionStore`, content-derivation factory, profile namespace, and any real epoch-local pools or locks.
- A **GenerationCandidate** is the complete immutable logical candidate produced after record validation, cross-file validation, prepare finalization, effect finalization, diagnostic finalization, and canonical ordering. It includes immutable publication intent and its expected logical and physical bases.
- A **Generation** is the current committed in-memory record, effect, diagnostic, logical-output, owner-index, and patch-index truth.
- A **Publication** is the validated physical projection selected by the configured atomic pointer. It consists of a collision-resistant `PublicationId`, sealed descriptor, data manifest, asset-reference manifest, published-file manifest, and predecessor/recovery metadata. A recovered Publication does not fabricate a Generation.
- A **cleanup plan** is one finite canonical post-commit attempt snapshot. A **cleanup backlog** is persisted or reconstructible retry and deletion authority that may outlive an operation or process.
- An **admitted operation** is a private coordinator-owned record containing Builder identity, operation ordinal, kind, target epoch, expected Generation base, expected Publication, applicable replay checkpoint, one-shot publication-attempt state, and settlement state. These are private fields and predicates, not independently injectable services, registries, tokens, or stable module identities.

### Sole Builder authority

`createBuilder()` creates exactly one Builder-local deep module named conceptually `BuilderCoordinator`. The public Builder facade delegates build, apply, watch, reload, clean, and disposal behavior to it.

`BuilderCoordinator` is the sole authority for:

- operation admission;
- Builder state `open -> disposing -> disposed`;
- warming, active, draining, and disposed epoch transitions;
- the Builder-owned watch replay log and per-operation replay checkpoints;
- current committed Generation;
- current and direct-predecessor Publication;
- recovered Publication and validated cleanup backlog;
- publication authorization and expected-base validation;
- publication and cleanup mutation ordering;
- synchronous Generation, Publication, epoch, and committed-checkpoint installation after pointer success;
- operational-diagnostic snapshot timing; and
- the disposal completion predicate and its derived wait set.

An epoch owns its internal resources but does not admit Builder operations, authorize publication, or install current state. A Driver receives immutable operation input and any required immutable base snapshot and returns one complete immutable `GenerationCandidate`. It receives no publication capability and cannot stage, commit, replace current state, activate an epoch, retire output, or schedule authoritative cleanup.

Writers stage bytes and return immutable staging results. Manifest codecs encode, decode, and validate values. Filesystem, cleanup, watcher, scheduler, image, and atomic-pointer adapters execute requested effects. None owns or determines current Generation, current Publication, predecessor status, publication authorization, cleanup authority, or disposal truth.

This is one semantic authority, not a requirement for one source file or class. Internal helper functions and adapters remain explicit dependencies of the coordinator implementation.

### Admission and publication authorization

Admission linearizes when `BuilderCoordinator`, while state is `open`, creates the private admitted-operation record and binds it to its target epoch. Method invocation, Promise creation, scheduler enqueue, callback execution, and completion order are not admission.

Immediately before staging, and again immediately before pointer replacement, the coordinator validates:

1. the operation was admitted by this coordinator while it was open;
2. the operation has not settled or consumed its publication attempt;
3. the candidate belongs to that operation and target epoch;
4. the target epoch remains publication-eligible and has not been superseded;
5. the expected Generation base remains current;
6. the expected physical Publication remains current;
7. the applicable replay checkpoint is complete; and
8. the staged descriptor, manifests, paths, and required blobs still validate.

Builder state `disposing` does not invalidate an operation admitted before disposal. Epoch supersession, stale logical base, stale physical base, incomplete replay checkpoint, consumed authorization, or another failed ordinary predicate returns an immutable `superseded`, `stale`, or `abandoned` control outcome. Wrong-Builder records, impossible repeated publication, invalid state transitions, or implementation-owned use after terminal disposal remain `VeliteError('internal')`.

No captured Driver, writer, codec, adapter, candidate, staging reference, callback, or old epoch can create a new admitted operation or reacquire publication authority.

### Candidate, publication, cleanup, and result sequence

A successful full, patch, initial-watch, rebuild, or reload operation follows this exact order:

1. Admit the operation and capture its target epoch, expected Generation base, expected Publication, and applicable replay checkpoint.
2. Invoke the epoch Driver and receive one complete immutable GenerationCandidate.
3. Apply fatal and durable strict policy to the finalized immutable diagnostics.
4. Validate expected bases and operation eligibility before staging.
5. Stage through the writer and validate the sealed descriptor, manifests, normalized paths, and content identities.
6. Enter the coordinator's serialized publication-and-cleanup mutation order.
7. Revalidate authorization, bases, checkpoint completeness, descriptor, manifests, and every required content-addressed blob after earlier cleanup and immediately before pointer replacement.
8. Atomically replace the configured pointer using the expected current `PublicationId`.
9. Without an intervening `await`, install the committed Generation and new current Publication. Move the prior current Publication to direct predecessor. For reload, install the active epoch and committed replay checkpoint and move the prior active epoch to draining in the same coordinator transition.
10. Mark the operation's publication attempt consumed and release the state critical section. Commitment is now irrevocable.
11. Snapshot one finite canonical cleanup plan from the Publication displaced beyond direct predecessor, validated transition authority, and validated retry backlog.
12. Await exactly one first cleanup attempt. Every selected item reaches `deleted`, `absent`, `failed`, `timeout`, or `partially-deleted`.
13. Persist or reconstruct backlog authority for failed, timed-out, and partially deleted items.
14. Form a fresh recursively immutable `operationalDiagnostics` snapshot from post-commit facts observed before result construction.
15. Construct `BuildResult` as a total synchronous detached projection over committed normalized values.
16. Return without further I/O, serialization, or user callback.

Pointer replacement and cleanup deletion are serialized by the coordinator. A later candidate may derive or stage concurrently, but no cleanup deletion may interleave its final blob validation and pointer replacement. Every later candidate revalidates all required blobs after earlier cleanup and immediately before its pointer replacement.

The first attempt is finite because its membership is snapshotted before execution; it does not wait for the backlog to become empty. A cleanup adapter may report `timeout` only after mutation has settled or cancellation is confirmed and no hidden mutation remains. Successful or absent items leave the backlog. Failed, timed-out, and partially deleted items remain. Later retries are separately admitted operations, recalculate protection at retry time, and never mutate an earlier result.

`BuildResult.diagnostics` is the committed prepare-finalized snapshot. `BuildResult.operationalDiagnostics` is a distinct immutable snapshot. Cleanup, logger, reporting, or evidence-retention failure cannot change committed diagnostics, writes, logical output, current pointer, current Generation, or operation success.

`BuildResult` construction is infallible within the public protocol: it performs no I/O, serialization, logging, callback invocation, or user code. There is no public committed-but-no-result variant and no operational diagnostic for an impossible result-construction invariant. An implementation violation is a product bug; confirmed pointer commit remains committed truth.

### Full, patch, strict, and `prepare(false)`

Full and incremental operations produce the same complete candidate and use the same authorization and commit sequence. A patch starts from its expected current Generation, removes complete old owner state, installs complete valid replacement owner state, reruns simultaneous cross-file validation, and canonicalizes the full candidate. A failed or stale patch changes nothing and must retain or replay complete dirtiness before a later patch.

Fatal and strict policy run after prepare/effect/diagnostic finalization and before staging for every full, manual, initial-watch, rebuild, patch, and reload operation. A rejected operation publishes and deletes nothing and preserves the previous Generation and Publication.

A clean `prepare(false)` operation commits a new Generation and an explicitly empty current Publication. The prior current Publication becomes the protected direct predecessor. It is no longer externally current, but it is not retirement-eligible until another successful pointer advance displaces it beyond the predecessor window. `BuildResult.output` reflects committed logical output and `written` is empty.

### Watch replay and epoch lifecycle

The BuilderCoordinator owns one sequenced replay log. Each candidate records the greatest event sequence it incorporated. During final authorization, the coordinator captures the current accepted checkpoint. If a relevant event exists after the candidate checkpoint, the staged candidate is stale and is abandoned; catch-up, rebuild, and restaging happen before a later authorization attempt. No event replay, candidate mutation, or restaging occurs inside the final pointer-replacement critical section.

Watch coverage is ready before the initial snapshot. During reload, old and warming coverage overlap. A relevant configuration event invalidates the warming epoch. A failed load, warming build, catch-up, policy gate, staging, authorization, or pointer replacement leaves the old active tuple unchanged.

A successful reload installs the new Generation, Publication, active epoch, and committed replay checkpoint synchronously after pointer success, then moves the old epoch to draining. Epoch supersession revokes old-epoch publication eligibility. Already admitted old work may settle but cannot mutate memo state, effects, diagnostics, assets, cleanup state, or current truth after its lifecycle guard closes.

Epoch states remain:

```text
warming -> active
warming -> draining -> disposed
active  -> draining -> disposed
```

An epoch owns only real resources. If no pool or lock exists, no pool/lock seam or lifecycle object is required.

### External readers and manifest-derived protection

Velite 1.0 has no managed-reader acquisition seam, reader lease, reader pin, reader registry, or reader-blocked disposal state.

An external reader obtains a supported snapshot by atomically resolving the configured current pointer and reading only paths validated by that Publication's descriptor. A Publication observed while current remains physically protected through at most one subsequent successful pointer advance. The reader must reacquire before the second advance. There is no indefinite path, opened-handle, duration, wall-clock grace, arbitrary cross-process lifetime, or persisted reader protocol.

Protection is derived exclusively from the validated manifests of current Publication and direct predecessor. It is not an independently owned object or registry.

A Publication directory becomes retirement-eligible only when it is neither current nor direct predecessor, its descriptor and paths validate under Velite-owned roots, and a committed transition or validated backlog authorizes retirement. A content-addressed blob becomes retirement-eligible only when neither current nor direct-predecessor Publication references the same identity and digest, its path validates under the Velite-owned blob root, and committed transition or validated backlog authority exists.

Shared blobs remain protected while referenced by either protected Publication. Source path, file presence, discovery history, directory enumeration, one unvalidated manifest comparison, object identity, and wall-clock age are never deletion authority.

### Recovery, residue, and explicit clean

Cold recovery reads only the configured pointer and sealed current descriptor. It validates current Publication, direct predecessor, and cleanup backlog metadata without fabricating a Generation. The first normal build still performs full derivation.

Corrupt, escaped, missing, inconsistent, or unverifiable metadata authorizes neither publication nor deletion. Orphan staging directories, unidentified blobs, and unknown trash are never promoted or deleted by ordinary cleanup. They remain residue until explicit clean.

Validated partial deletion and backlog entries retry idempotently. A crash after pointer success but before first cleanup remains recoverable because committed metadata carries predecessor and retry authority. Explicit clean is a separately admitted destructive operator assertion with path-containment validation. It is not ordinary retirement or backlog processing.

### Builder disposal and derived wait set

The first `dispose()` atomically changes `open` to `disposing`, closes admission, and stores one shared settlement Promise. Concurrent and later disposal calls return that Promise.

Operations admitted before disposal retain ordinary publication authority subject to epoch, expected-base, replay-checkpoint, and one-shot authorization predicates. Operations presented after disposal linearizes are rejected before derivation, staging, or publication. Disposal is not epoch supersession and does not revoke a pre-disposal operation solely because Builder state is `disposing`.

Disposal does not use an independently mutable ledger or wait registry. Its wait set is derived from coordinator-owned state:

- unsettled operations admitted before disposal, including their first cleanup and result settlement;
- the current watch close, admitted scheduler callbacks, and admitted replay work;
- cleanup attempts or retries admitted before disposal;
- warming, active, and draining epochs and their actual resources; and
- non-terminal adapter operations owned by those operations.

Persisted inactive cleanup backlog does not block disposal. No reader condition can block disposal because no managed-reader seam exists. A never-settling plugin or non-terminal adapter operation may keep disposal pending indefinitely. No timeout, forced release, false terminal success, or public hard cancellation is fabricated.

Disposal must not supersede an epoch while a pre-disposal admitted operation still requires that epoch's publication eligibility. Once publication-capable admitted work settles, remaining epochs drain and dispose. After `disposed`, only repeated idempotent disposal or close observation is allowed; no captured reference can recreate operation, epoch, replay, cleanup, or publication authority.

### Parallel Builder isolation and negative surfaces

Parallel Builders own separate coordinators, admitted-operation records, operation ordinals, epochs, Generations, Publications, replay logs, cleanup plans, backlogs, active cleanup attempts, and disposal Promises. The process-wide `SchemaContextHost` owns none of them. Concurrent writers deliberately targeting the same physical output root remain unsupported without an explicit runtime cross-writer exclusion adapter; no process-global in-memory registry or lock pretends to solve cross-process coordination.

The following are representation choices, not stable modules or test identities: staging transaction object, authorization record layout, private epoch revision fields, replay-checkpoint representation, admitted-operation storage, protection calculation, trash-rename strategy, cleanup worker structure, and private instrumentation transport.

No root declaration, runtime export, export-map subpath, public context, reflection-visible public object, or process-global mutable object exposes Generation, Publication, BuilderCoordinator, operation records, staging state, manifests as authority, replay state, epoch state, cleanup authority, or instrumentation.

### Acceptance oracle and cross-ticket effect

Acceptance must cross-check semantic Generation values, controlled adapter calls, persisted pointer/descriptor/manifests, replay checkpoints, cleanup backlog, and coordinator state predicates. Event-name presence alone is insufficient.

Acceptance fails on competing logical owners; Driver/writer commit authority; stale or superseded pointer change; event loss; candidate mutation in the final critical section; mixed/partial publication; pre-commit cleanup; deletion without validated manifest authority; loss of current/predecessor/shared blobs; reclassification of confirmed commitment; result before first-attempt terminality; post-result mutation; post-disposal admission; late old-epoch mutation; cross-Builder state; any managed-reader product seam; or any public/process-global registry.

Ticket 18 must describe only the external predecessor window and supported disposal behavior. Ticket 25 must observe this semantic authority through private write-only witnesses plus adapters/manifests/state and must remove reader-acquire, pin, separate publication-owner, and mechanism-identity gates. Ticket 11 must treat all demoted mechanism names as implementation freedom while preserving every observable invariant above.
