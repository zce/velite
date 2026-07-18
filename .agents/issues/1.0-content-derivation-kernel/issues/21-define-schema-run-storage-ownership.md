# Define schema run storage ownership

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 05, 19

---

## Question

Who owns and installs the process-wide schema-run context storage, and how do multiple concurrent Builders, injected test adapters, Builder disposal, and configuration reload preserve explicit dependency injection without replacing a live adapter or creating an unsupported hidden singleton?

## Review context

The internal leased `SchemaRunContext` is a justified candidate extension of the Zod ambient exception, but the current public `builder()` creates a new storage adapter for every Builder while `createBuilder()` installs it. Define one explicit owner, installation conflict behavior, test injection, teardown expectations, and the corresponding update to the architecture knowledge contract.

## Answer

### Selected decision

Authorize one process-wide `SchemaContextHost` as the sole ambient architecture exception required by Zod callbacks. The default Node runtime composition root owns it for the process lifetime. The host only propagates the current `SchemaRunContext` across synchronous and asynchronous execution and rejects missing or inactive leased carriers. It owns no broker, pipeline, Builder, configuration, epoch, cache, filesystem, logger, registry, session, or other unrelated capability.

The first public `builder()` call installs or obtains the module-private default Node host. Every later `builder()`, `build()`, and `watch()` call obtains that same host. Installing the identical host object is idempotent. Attempting to install a different host after the first installation is always a deterministic internal configuration failure, even when no Builder is currently live. There is no reset, replacement, reference-counting, or disposal protocol.

The module-level installation slot is controlled process ownership rather than a general singleton module. It stores one immutable-after-install host identity solely so the parameterless public `context()` accessor and the private content accessor necessarily read the same carrier. It offers no token lookup, dynamic registration, capability collection, or service discovery.

### Public and internal interfaces

The conceptual internal interfaces are:

```ts
interface SchemaContextHost {
  run<T>(context: SchemaRunContext, operation: () => T): T
  get(): SchemaRunContext
}

interface SchemaRunner {
  run<T>(input: SchemaRunInput, operation: () => T | PromiseLike<T>): Promise<T>
}
```

`SchemaContextHost` is the process-owned runtime adapter. Its `run()` preserves the callback return type and therefore supports both synchronous and asynchronous callback results. Its storage semantics must preserve LIFO nesting, restore the outer carrier after an inner run, and isolate concurrent async chains. `get()` returns only an active carrier; a missing or inactive carrier is an internal invariant failure.

`SchemaRunner` is the narrow capability explicitly injected into the internal Builder, pipeline, and validate composition. It accepts synchronous or asynchronous operations but always returns `Promise<T>` so lease closure occurs after settlement. It constructs the private carrier, creates the lease, wraps record-bound capabilities with that lease, delegates propagation to the host, awaits the operation, and deactivates the lease in `finally`.

`SchemaRunInput` contains the distinct public `SchemaContext` view and the raw narrow record-bound `content(request)` operation required to construct the leased private capability. `SchemaRunContext` contains that public view, the leased private content capability, and the private lease. These are internal implementation types.

The exported `context()` calls the installed host, verifies the active lease through `get()`, and returns only `publicContext`. The private accessor performs the same carrier and lease check and returns only the narrow `content(request)` capability. The public view and private carrier remain different runtime objects. The carried content operation checks the same lease on every invocation before delegating to the record broker.

The host has no `dispose()`. Its lifetime is the process lifetime, and disabling it would invalidate unrelated live Builders and async chains. Process teardown releases it naturally.

### Composition and default Node installation

The root-package public composition surface is `builder()`, `build()`, and `watch()`. `builder()` is the default Node runtime composition facade: it installs or obtains the one module-private default Node host, obtains a `SchemaRunner` bound to that host, creates the per-Builder filesystem, module loader, logger, image processor, and watcher adapters, and calls the internal Builder composition root.

`build()` and `watch()` own only their facade operation and Builder lifetime. They do not own the process host. Repeated calls share the same host while receiving separate Builders and Builder-owned dependencies.

`createBuilder()` becomes an internal composition root and receives `schemaRunner` explicitly. It does not install, replace, acquire, reset, or release the host. Remove `createBuilder` from the 1.0 root-package exports rather than exposing `SchemaRunner` or weakening its construction contract through type erasure. Source-internal tests may import the internal composition root without creating a supported deep-import contract.

No host installer, host getter, `SchemaContextHost`, `SchemaRunner`, `SchemaRunInput`, `SchemaRunContext`, lease, private content capability, or test harness may be exported from the schema barrel, core barrel, root package, or package export map. They must not be reachable from built public declarations or appear among built runtime exports. Root-package runtime reflection continues to expose only supported public values.

### Ownership and lifecycle

| State                                                                   | Owner                       | Lifetime                   | Terminal action          |
| ----------------------------------------------------------------------- | --------------------------- | -------------------------- | ------------------------ |
| Installed host identity and async propagation adapter                   | Default process composition | Process                    | None                     |
| Builder runtime state, watcher, scheduler, and active session reference | Builder                     | `builder()` to `dispose()` | Builder disposal         |
| Pipeline, broker factory, profile namespace, and epoch-owned state      | Pipeline epoch              | One configuration epoch    | Epoch disposal           |
| Content broker, parse slots, and retained artifacts                     | Record validation           | One record validation      | Record outer `finally`   |
| Carrier and active lease                                                | Schema runner               | One schema run             | Runner `finally`         |
| Branch-local mutable state                                              | One broker demand           | One branch execution       | Branch/broker completion |

Record validation opens a broker before calling `SchemaRunner.run()`. The runner closes the lease before validation's outer `finally` disposes the broker. Success, Zod failure, synchronous throw, asynchronous rejection, and abandonment use the same cleanup ordering.

Nested schema runs bind an inner carrier and restore the still-active outer carrier afterward. Parallel records and parallel Builders share the host but use distinct async chains, carriers, leases, capabilities, and brokers. Sibling schemas in one record share that record's capability and broker.

Builder disposal releases only Builder-owned state and does not dispose or replace the process host. Disposing Builder A cannot affect Builder B. Configuration reload creates a replacement pipeline epoch, session store, broker factory, profile namespace, and future record brokers; it never installs, replaces, or disposes the process host. An old callback retains only its old carrier and eventually inactive lease and cannot resolve through a new epoch.

Builder disposal, epoch disposal, record broker disposal, lease closure, and process host lifetime require separate state and separate test oracles. This decision does not define the general behavior of calling arbitrary Builder methods after Builder disposal; that belongs to the Builder and epoch lifecycle contract rather than host ownership.

### Injected adapters and parallel tests

Internal tests use one installed host per test process. A source-internal bootstrap installs a shared test host once, and all schema harnesses and injected Builders obtain runners from that host. Each test supplies independent `SchemaRunInput`, fake content capability, carrier, lease, and broker state; tests do not replace the host in `beforeEach` or `afterEach`, do not reset global storage, and do not depend on test-file execution order.

A public default Builder and a source-internal harness running in the same process must obtain the same default Node host rather than compete to install different hosts. Tests that must exercise a different host implementation or first-install conflict use an isolated process or worker. A host adapter's nesting and parallel-propagation behavior can also be tested on an uninstalled adapter object without mutating the process installation slot.

The internal harness is not a root export, does not appear in built declarations or the export map, and carries no compatibility guarantee. This model allows schema unit tests and Builder tests to run concurrently because isolation is provided by per-run carriers and leases rather than host replacement.

### Private capability boundary

The private content capability remains a narrow domain operation, not a service locator. It has exactly one controlled `content(request)` operation; callers cannot supply arbitrary compute callbacks or cache keys and cannot obtain the broker, request registry, parser registry, cache controls, lifecycle controls, filesystem, logger, pipeline, Builder, or epoch. Broker and factory construction remain explicit factory dependencies assembled by `createPipeline()` and passed through validate. The ambient exception only compensates for Zod's inability to accept the current record execution context explicitly.

The exception must never grow into a token-based capability registry or a second cache. Adding unrelated capabilities to the carrier or host violates this decision.

### Error and failure behavior

The following are `VeliteError('internal')` failures with no diagnostics:

| Failure                                                      | Meaning                                           |
| ------------------------------------------------------------ | ------------------------------------------------- |
| A schema runner or accessor is used before host installation | Internal composition failure                      |
| A different host is installed after the first host           | Deterministic internal configuration failure      |
| `context()` or the private accessor has no bound carrier     | Internal invariant failure                        |
| Either accessor observes an inactive lease                   | Internal invariant failure                        |
| A captured leased capability is invoked after lease closure  | Internal invariant failure before broker dispatch |
| A captured broker-bound operation reaches a disposed broker  | Broker terminal-state invariant failure           |

Installing the same host is a no-op. Builder disposal must not invalidate another Builder's host or carrier, and one Builder's reload must not affect another Builder's host or carrier. User schema validation issues continue through Zod issues and build diagnostics; they must never be converted into the internal throw channel merely because validation runs through the host.

### Alternatives rejected

1. **Install one storage per `createBuilder()`.** The most recently created Builder silently changes the adapter used by existing Builders, disposal and reload ownership become ambiguous, and parallel tests become execution-order dependent.
2. **One process-wide host installed by the default Node runtime composition root.** Selected because it gives every accessor one stable authority while async carriers preserve record and Builder isolation.
3. **Separate ambient hosts for public context and private capability.** This duplicates installation and nesting and permits mismatched states where only one carrier is present.
4. **A generic token-based ambient capability registry.** This is a service locator with hidden dependencies and invites unrelated runtime capabilities into the exception.
5. **Put the broker or capability on public `SchemaContext`.** This violates the custom-schema black-box contract and exposes cache and lifecycle semantics.
6. **Capture a Builder or broker in a schema-root closure.** A config-epoch schema has no stable record value; mutable rebinding races parallel records and retaining the closure leaks record lifetime.
7. **Hide the capability with a private TypeScript type, symbol, or non-enumerable property.** The capability still exists on the public runtime object and remains discoverable through reflection.
8. **Keep root-exported `createBuilder` with a type-erased runner.** This makes the legal construction invariant invisible and moves configuration mistakes to runtime. Removing the pre-1.0 export is the smaller honest interface.
9. **Allow replacement when no Builder appears live.** This requires a process-wide Builder registry, reference counts, and race-prone liveness tracking, expanding the host beyond propagation and lease checking.

### Migration consequences

- Remove `contextStorage` from internal `BuilderDeps` and replace it with an internal `schemaRunner` dependency.
- Move default host acquisition and installation to the default Node runtime composition used by public `builder()`.
- Remove `createBuilder` from root runtime exports, root declarations, public API tests, built-dist tests, and documentation; internal tests import the source-internal composition root.
- Replace tests that install `ContextStorage<SchemaContext>` at module scope or inject storage per Builder with the shared internal runner/harness.
- Preserve public `context(): SchemaContext`; no host, runner, carrier, lease, or private capability is added to the public interface.
- Keep runtime-specific host implementation behind the runtime adapter seam. Non-Node internal compositions must install their chosen process host once before creating runners.
- No pre-1.0 compatibility shim, public install/reset function, or replacement protocol is required.

### Architecture knowledge updates required during implementation

Update `.agents/knowledge/module-architecture.md` to record that the sole ambient exception is a process-owned `SchemaContextHost<SchemaRunContext>`, not a metadata-only `ContextStorage<SchemaContext>` installed by each Builder. Document its owner, default installation point, process lifetime, same-host idempotence, different-host failure, and prohibition on reset or replacement. State that Builder, pipeline, validate, and broker dependencies remain explicit factory DI and that the host may not gain logger, filesystem, registry, cache, pipeline, Builder, epoch, or unrelated capabilities.

Update `.agents/knowledge/schema-context.md` to describe the distinct public view and private leased carrier, runner-owned lease lifecycle, record-owned broker lifecycle, nested and parallel propagation, and the rule that config reload and Builder disposal do not control host lifetime. Document internal shared-host test injection and prohibit public installation or reset APIs.

### Acceptance tests

1. The first default `builder()` installs or obtains the process host.
2. Two default Builders use the identical host while their record carriers, leases, capabilities, and brokers remain distinct.
3. Disposing Builder A leaves Builder B able to execute schemas.
4. Configuration reload does not install, replace, reset, or dispose the host.
5. Installing the identical host is idempotent.
6. Installing a different host produces a deterministic `VeliteError('internal')`.
7. A nested run sees the inner context and restores the outer context afterward.
8. Parallel records and parallel Builders never exchange context or private demands.
9. Synchronous return, asynchronous resolve, and asynchronous reject all close the lease at operation settlement.
10. Public and private accessors under an inactive lease produce `VeliteError('internal')`.
11. A captured content capability fails after lease closure, and a broker-bound operation fails after broker disposal.
12. `context()` returns the distinct public view rather than the carrier.
13. `Reflect.ownKeys(context())` exposes no carrier, lease, private capability, or private symbol.
14. Root exports, package export map, built runtime exports, and built declarations expose no host installation, runner internals, `SchemaRunContext`, lease, or private content capability.
15. The internal test harness runs schema unit tests with fake capabilities without replacing the process host.
16. Tests run concurrently without global reset or execution-order assumptions.
17. Builder disposal, process host lifetime, epoch disposal, broker disposal, and lease closure use distinct identity or counter oracles.
18. Reload in Builder A leaves an active carrier in Builder B unchanged.
19. User Zod validation issues remain validation results and diagnostics rather than internal throws.

### Superseded clauses

This answer refines the following clauses in [Resolve the internal content capability seam](19-resolve-the-internal-content-capability-seam.md):

- "The process composition root installs one context-storage adapter" now specifically means that the default Node runtime composition owns one process-wide `SchemaContextHost`.
- The allowance that the runtime dependency "may remain type-erased at a public construction boundary" is superseded: the runner enters only the internal `createBuilder`, which is removed from root exports.
- The conceptual `runWithContext` lease owner is fixed as `SchemaRunner`; the host propagates and checks the resulting carrier.

That ticket's single-carrier model, distinct public view, private capability, active-lease protection, nested and parallel isolation, and rule that reload never reinstalls storage remain in force.

### Effects on other tickets

- [Reconcile parse sharing and VFile continuity](22-reconcile-parse-sharing-and-vfile-continuity.md) remains the next independent frontier decision; this answer does not decide VFile state.
- [Complete effect and diagnostic transaction seams](23-complete-effect-and-diagnostic-transaction-seams.md) may rely on the leased record carrier but must not add diagnostic sinks or provenance registries to the host.
- [Define generation publication and epoch lifecycle](24-define-generation-publication-and-epoch-lifecycle.md) must keep epoch disposal and process host lifetime separate.
- Migration guidance must record removal of the root `createBuilder` export and the unsupported status of internal host and harness imports.
- No existing open ticket is invalidated, and no blocking edge changes are required.
