# Resolve the internal content capability seam

Status: resolved
Created: 2026-07-17T00:00:00Z
Type: grilling
Blocked by: 05, 07, 09

---

## Question

How should Velite-owned schema roots and projections access the record-scoped Content Artifact Broker when the public `SchemaContext` has no internal-only tier and custom schemas must not receive a broker, generic demand operation, request constructors, or cache lifecycle capabilities?

## Answer

### Decision

Use one internal ambient **`SchemaRunContext`** for each record validation. It contains a distinct public `SchemaContext` view, one private record-bound content capability, and a private active lease. The exported `context()` accessor returns only the public view. Velite-owned content roots and projections use an unexported internal accessor, conceptually `contentContext()`, which returns only the narrow content capability after checking the lease.

Conceptually:

```ts
interface SchemaRunContext {
  readonly publicContext: SchemaContext
  readonly contentCapability: ContentCapability
  readonly lease: SchemaRunLease
}

interface ContentCapability {
  content<T>(request: InternalContentRequest<T>): Promise<ContentBranchOutcome<T>>
}
```

`InternalContentRequest`, its controlled constructors, `ContentCapability`, `ContentBranchOutcome`, `SchemaRunContext`, the lease, and `contentContext()` are implementation details. None is exported from the schema barrel, core barrel, root package entry, or package export map. The capability has exactly one operation. It exposes no broker object, arbitrary compute callback, caller-authored cache key, parser or processor registry, cache inspection, invalidation, disposal, engine, filesystem, logger, or diagnostic channel.

This resolves the wording conflict between the earlier broker and custom-schema decisions: validate binds the narrow capability into the internal schema run, not into the public `SchemaContext`. A schema root stores only immutable dialect and effective-profile descriptors. Its transform selects explicit input or file-body fallback and submits its controlled descriptor through `contentContext().content(...)`; it never stores a broker or another record-scoped object.

This is an intentional ambient dependency forced by Zod's callback interface, but it is not a general service locator. There is no token-based lookup or collection of unrelated services, and construction, epoch ownership, opening, and disposal remain explicit dependencies of pipeline and validate. Adding unrelated capabilities to the private accessor would violate this decision.

### Interface visibility

| Surface                     | Fields or capabilities                                                                   | Visible to custom schemas | Visible to Velite-owned content schemas                     |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| Public `ContentFile`        | `id`, `path`, `content`                                                                  | Yes                       | Yes, through the public view when source metadata is needed |
| Public `SchemaContext`      | `project`, `file`, `record`, `store`, `collectEffect`, `asset`, `readFile`, `probeImage` | Yes                       | Yes                                                         |
| Internal `SchemaRunContext` | `publicContext`, `contentCapability`, private active lease                               | No                        | Indirectly, only through the two accessors                  |
| Exported `context()`        | Returns only the distinct public `SchemaContext` object                                  | Yes                       | Yes                                                         |
| Private `contentContext()`  | Returns only `content(request)` after an active-lease check                              | No                        | Yes, from Velite-owned implementations only                 |
| Zod callback context        | Normal Zod value and `addIssue()` facilities                                             | Yes                       | Yes                                                         |

All eight existing public `SchemaContext` fields remain public. This follows the custom-schema contract: project/file/record metadata, session store, declarative effects, and existing asset/image capabilities remain available. Diagnostics are not added to `SchemaContext`; custom schemas continue to report validation problems through Zod `addIssue()`. `SessionStore` remains custom-owned session state and is not a broker cache or a transaction mechanism.

The public view and internal carrier must be different runtime objects. The implementation must not create an intersection object and hide fields only with a TypeScript cast, use non-enumerable properties, or attach a private symbol. Normal root-package imports, public declarations, `context()`, property enumeration, and `Reflect.ownKeys(context())` must reveal no private capability.

### Public `ContentFile`

Remove `ContentFile.mdast`, `ContentFile.hast`, and `ContentFile.plain` in 1.0. Keep only stable source metadata and the raw body: `id`, `path`, and optional `content`.

The current derived fields cannot be retained with honest stable semantics:

- `mdast` and `hast` are mutable representations whose dialect, parser extensions, profile, ownership, and safe lifetime are unspecified. Exposing either conflicts directly with the decision that custom schemas receive no public or pristine AST.
- `plain` is immutable as a string but is currently produced by the same hidden Markdown-only `mdast -> hast -> text` cache. It therefore has an implicit dialect and parse profile, ignores root configuration, cannot represent explicit selected input, and would create a second public derivation model beside the broker.
- The current cache can return an AST for the file body even when a schema selected a different explicit value, and it parses MDX-derived fields as ordinary Markdown. It is not merely an unsafe optimization; it cannot satisfy the selected Content Input and dialect/profile invariants.

Velite-owned root, TOC, excerpt, and metadata schemas move to controlled private broker requests. A custom schema that needs an AST parses `value ?? context().file.content` itself and owns the parser, tree, mutation, cache, and lifetime. A custom schema that only needs plain text similarly derives it from its selected raw input under its own declared semantics. No safe snapshot alternative is added in 1.0 because defining its dialect, profile, explicit-input behavior, copying rules, and cost would stabilize another content model without evidenced need.

### Alternatives rejected

| Candidate                                                  | Interface depth and dependency visibility                                                                                        | Propagation and test seam                                                                                                                     | Visibility, lifecycle, and composition                                                                                                                       | Decision |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| One internal `SchemaRunContext`                            | One domain operation hides broker, cache, parser, cloning, and lifecycle; factory remains explicit through pipeline and validate | Reuses one async context; tests inject a fake private capability through the internal harness                                                 | Public and private objects are distinct; one lease and one broker lifetime remain atomically associated; ordinary Zod wrappers execute inside the same run   | Selected |
| Two independent ambient contexts                           | Duplicates the execution seam without adding caller leverage                                                                     | Requires two storage hosts, two installation paths, paired nesting, and a larger test harness                                                 | Can produce a public context with no matching private context; creates a second context storage and more lifecycle mismatch states                           | Rejected |
| Private symbol on the public context                       | Small type surface but places the capability on the public runtime object                                                        | Reuses one storage and is easy to test                                                                                                        | Discoverable through reflection and retainable with the public object; normal custom code can cross the intended capability boundary                         | Rejected |
| Module-private `WeakMap<SchemaContext, ContentCapability>` | Keeps the object clean but introduces an implicit registration and lookup side table                                             | Requires public-object identity registration in every harness and extra missing-key cases                                                     | Garbage collection is not broker disposal; lifecycle still needs explicit cleanup, and the side table adds no leverage over an internal carrier              | Rejected |
| Preplanning or branded-schema recognition in validate      | Makes validate understand schema representation and a hidden planning protocol                                                   | Planner tests are possible, but unions, lazy schemas, pipes, transforms, and wrappers require unstable Zod introspection or brand propagation | Conditional branches can precompute unused artifacts; brands or descriptors become observable runtime protocol; conflicts with custom schemas as black boxes | Rejected |
| Runtime capability captured by schema closure              | Appears small but hides a record dependency in a config-epoch object                                                             | Construction-time injection has no correct record value; mutable rebinding races parallel records                                             | Direct capture leaks broker lifetime; dynamic ambient lookup is only the selected design with worse naming                                                   | Rejected |

The selected module is deeper because callers learn one controlled content operation while parser selection, exact matching, in-flight sharing, branch isolation, outcomes, and disposal remain local to the broker implementation. It also gives tests the same narrow seam used by production without exposing that seam publicly.

### Runtime propagation and lifecycle

1. The process composition root installs one context-storage adapter whose internal carried value is `SchemaRunContext`. The runtime dependency may remain type-erased at a public construction boundary so internal types do not appear in root declarations. Reinstalling the same adapter may be idempotent; silently replacing it with a different adapter while builders are live is an internal configuration error. Config reload never reinstalls storage.
2. `createPipeline()` explicitly assembles the epoch-local `ContentArtifactsFactory`, dialect adapters, and profile-identity namespace, then passes the factory to the validate derivation. A config reload creates a new pipeline, factory, profile namespace, session store, and future record brokers.
3. Immediately before one record's `safeParseAsync()`, validate calls `factory.open(recordScope)`. It creates a fresh public `SchemaContext` object and a private capability closure whose only operation delegates a controlled request to that broker.
4. `runWithContext({ publicContext, contentCapability }, run)` creates the private active lease and binds one `SchemaRunContext` through the installed storage. It awaits `run` and deactivates the lease in its own `finally`. The exported `context()` reads the run, verifies the lease, and returns only `publicContext`. The private accessor performs the same checks before returning `contentCapability`.
5. Validate awaits `runWithContext(..., () => schema.safeParseAsync(raw.data))` and disposes the broker in an outer `finally`. Disposal is idempotent and marks the broker terminal before releasing slots and retained artifacts. Success, Zod failure, an escaping exception, and abandonment all take the same cleanup path.
6. A missing run or inactive lease in either accessor is an internal invariant failure, represented as `VeliteError('internal')`, not a user diagnostic. A captured private capability invoked after disposal reaches the broker's terminal check and fails the same way.
7. An async callback created during validation but not awaited may retain an AsyncLocalStorage value after the parent run settles. The active lease closes this hole: later accessor calls fail even if storage still returns the old carrier. Record-bound public capability closures that can collect or commit work must use the same lease guard. Retaining plain metadata does not retain the broker.
8. Work already started before disposal may settle for existing waiters, but it cannot reinsert broker slots or commit values, effects, diagnostics, or assets after the record transaction closes. There is no cancellation interface in 1.0.
9. Async context nesting gives an inner record its own carrier and restores the outer carrier afterward. Parallel records and builders use separate async chains, carriers, leases, capabilities, and brokers even though they share one storage adapter. Sibling schemas in one record receive the same record capability and broker.
10. Reload replaces the factory by replacing the pipeline epoch, not by mutating process-wide context storage. Old callbacks retain only their old, eventually inactive carrier and disposed broker; they cannot resolve against the new factory.

`runWithContext` and storage installation remain internal harness functions rather than root exports. Deep or source imports are unsupported implementation details and receive no 1.0 compatibility promise.

### Testing seam

Production tests do not require a public broker, debug accessor, or package export.

- Built-in schema unit tests import the source-internal run harness directly and inject a fake `ContentCapability`. The fake records controlled request descriptors and returns branch outcomes. Tests assert selected explicit versus fallback text, source path, Markdown versus MDX dialect, effective profile, projection kind/options, and outcome-to-Zod adaptation.
- Root tests assert that roots and sibling projections retain only immutable dialect/profile/recipe descriptors and no runtime capability or broker. Ordinary Zod wrappers are tested by execution, not by brand discovery.
- Validate tests inject a fake broker factory at the explicit validate factory seam. They assert one `open` and one `dispose` per record on success, Zod failure, throw, and abandonment, and that no broker crosses record or epoch boundaries.
- Public TypeScript contract tests assert that `SchemaContext` has the eight documented fields, `ContentFile` has only `id`, `path`, and `content`, and `content`, broker types, request constructors, cache types, `SchemaRunContext`, `mdast`, `hast`, and `plain` are unavailable. Negative imports and property accesses use `@ts-expect-error` in the root-package consumer fixture.
- Public runtime tests call `context()` inside a custom transform and inspect own string and symbol keys. The returned object must be only the public view and must not be the internal carrier. A custom callback can use every documented public capability but cannot obtain the fake private capability.
- Concurrency tests run at least two records in parallel with distinct fake capabilities and nested runs with different record identities. Requests must stay with their originating record; the inner run must restore the outer run after completion.
- Lifecycle tests retain an accessor and private capability, finish the run, dispose the broker, and verify that late accessor and demand calls fail as internal invariant errors. Separate tests verify that an already-started promise may settle but cannot perform a late commit.
- Built-dist and export-map contract tests assert that only the root public surface is available and that emitted declarations contain no internal carrier, capability, request, broker, or derived `ContentFile` fields.

The throwaway TypeScript/runtime prototype in `.agents/sessions/20260717-2216-internal-content-seam/` verifies public type exclusion, a runtime-clean public view, private demand across awaits, nested and parallel isolation, custom callback visibility, inactive-lease and post-disposal failures, descriptor-only roots, and a simulated public barrel without internal exports. Strict TypeScript checking and runtime execution pass. It is evidence for the seam, not prescribed production structure.

### Security and compatibility boundary

This is capability separation for a stable public interface under normal package use, not a malicious-code sandbox. Velite does not promise to defeat a user who reads package internals, bypasses the package export map, patches modules, or uses hostile JavaScript instrumentation. It does promise that supported root-package imports, public TypeScript declarations, the runtime object returned by `context()`, and ordinary reflection on that object expose no private content capability or broker representation.

Only root exports are a 1.0 compatibility surface. Source paths and deep imports, including any internal accessor or descriptor module reachable in a repository checkout or bundled implementation, are unsupported and may change without notice.

### Migration consequences for issue 18

- Remove `ContentFile.mdast`, `ContentFile.hast`, and `ContentFile.plain` from runtime construction, public declarations, API contract tests, and documentation. `SchemaContext` keeps its existing eight public fields; no public content field is added.
- Migrate custom schemas using `file.plain` to derive plain text from their own selected `value ?? file.content`. Migrate custom schemas using current runtime-only `file.mdast` or `file.hast` to parse and own their AST, dialect choice, plugins, mutation, and cache.
- Migrate Markdown/MDX roots, TOC, excerpt, and metadata implementations from `ContentFile` derived getters and direct processing to private controlled broker requests. Keep `raw` and stable source-metadata schemas on the public view where no derived artifact is needed.
- Replace tests that install `ContextStorage<SchemaContext>` with the internal schema-run harness and fake content capability. Add negative package contract coverage for all private types and removed fields.
- Stop documenting or relying on source/deep imports of schema context installation, `runWithContext`, content request descriptors, broker interfaces, or internal accessors. No compatibility shim is required before 1.0.

Issue 18 should explain these breaking changes and user migrations, but this ticket does not write the migration guide or prescribe the full implementation sequence.
