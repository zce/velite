# Module Architecture

Velite uses explicit factory dependency injection for modules that own dependencies, lifecycle, state, or replaceable capabilities. This is a hard rule for source architecture, but it is not a rule that every `.ts` file must be a factory.

## Canonical factory shape

Use explicit exported types plus a plain factory function. Do not add an identity helper such as `defineModule()` unless it enforces a real invariant that plain TypeScript cannot express.

```ts
export interface XxxDeps {
  dependency: Dependency
}

export interface Xxx {
  run(input: Input): Promise<Output>
}

export const createXxx = ({ dependency }: XxxDeps): Xxx => {
  return {
    async run(input) {
      return dependency.execute(input)
    }
  }
}
```

If the module already has an accurate domain type, use that name instead of adding a `Module` suffix. Example: `BuilderDeps` + `Builder` + `createBuilder()`. Zero-dependency factories may omit a deps parameter. Do not invent empty deps types solely for visual symmetry.

## When a factory is required

Use `createXxx(deps)` for modules that are any of the following:

- **Dependency-bearing**: uses filesystem, logger, image processor, module loader, watcher, config loader, network client, clock, random source, or other replaceable capability.
- **Stateful**: owns cache, manifest, engine state, scheduler state, watcher state, locks, mutable session state, or lifecycle handles.
- **Lifecycle-managed**: needs `dispose()`, `close()`, `clean()`, subscription teardown, or explicit initialization.
- **Composition-oriented**: wires multiple lower-level modules into a larger API.
- **Runtime adapter**: binds platform-specific implementations to runtime interfaces.

Dependencies must be visible and typed at the factory boundary. Do not create infrastructure dependencies inside a business module unless that module directly owns them.

## Composition roots

Concrete dependency wiring belongs in a dedicated composition root. Good examples:

- Public entry facades that assemble a runtime and call a builder factory.
- Runtime adapter modules that assemble platform capabilities.
- Builder or pipeline factories that compose smaller derivations or services from explicit inputs.

Composition roots may create default instances for public convenience, but the underlying capability should still be replaceable in tests.

The composition roots in this repo: `createBuilder` (`src/core/builder.ts`, internal — not a root export), `createPipeline` (`src/core/pipeline/index.ts`), the public `builder`/`build`/`watch` facades (`src/index.ts`), `createRunContext` + `createDriver` (`src/core/driver.ts`), `createSchemaRunner` + `ensureHostInstalled` (`src/core/schema/runner.ts`, installs/obtains the process-owned `SchemaContextHost`), `createScheduler` (`src/core/scheduler.ts`), and `createContentExecutionsFactory` (`src/core/content/execution/record.ts`, typed dialect/host dependencies assembled by the default public facade and injected through Builder/pipeline/validate).

The default public facade binds `SchemaRunner` and `ContentExecutionsFactory` to the same installed host and injects both into `BuilderDeps`. The internal Builder passes those dependencies to the pipeline; it does not acquire the host or create hidden defaults.

## Allowed direct exports

Do not wrap these in factories unless they later gain dependencies, lifecycle state, or a replaceable capability boundary:

- Pure functions and deterministic utilities (`src/core/util/`).
- Type-only modules, interfaces, and type aliases.
- Constants, symbols, and input keys.
- Error classes and assertion helpers.
- Schema builders, schema namespaces, and identity helpers such as `defineConfig` or `defineCollection`.
- Public facade functions that delegate to an internal composition root.

## Dependency and input separation

Keep construction dependencies separate from operation inputs.

```ts
// Correct
const users = createUserModule({ db, logger })
await users.getUser({ userId })

// Incorrect
await getUser({ db, logger, userId })
```

Dependencies and business inputs have different lifecycles and should not share the same parameter object.

## Prohibited patterns

The following are prohibited unless explicitly requested:

| Pattern                   | Example                                      | Reason                                      |
| ------------------------- | -------------------------------------------- | ------------------------------------------- |
| DI containers             | `container.resolve(...)`                     | hidden dependencies, hard tracing           |
| Service locator           | `services.user.getUser(...)`                 | dependencies become invisible               |
| Singleton modules         | `export const userService = ...`             | harder testing and lifecycle control        |
| Decorator-based injection | `@injectable()` / `@inject()`                | requires runtime metadata and hidden wiring |
| Runtime auto-registration | `loadModules()` / `scanDirectory()`          | dependencies become implicit                |
| Shared utility buckets    | `common` / `shared` / `utils`                | accumulate unrelated responsibilities       |
| Hidden global state       | `globalThis.xxx`, module-level mutable state | unless intentionally process-wide           |
| Dependency mixing         | `execute({ db, logger, userId })`            | different lifecycles conflated              |

Prefer domain-oriented modules over utility buckets.

## Allowed exception: ambient schema context

`context()` (`src/core/schema/context.ts`) is the one intentional piece of hidden global state in core. Zod's transform callback signature `(value, ctx) => ...` forbids passing ambient context explicitly, so a process-owned `SchemaContextHost` (`src/core/schema/host.ts`, see `schema-context.md`) propagates the `SchemaRunContext` through async transforms. The default Node runtime composition root (`builder()`/`build()`/`watch()` in `src/index.ts`) installs the host exactly once per process; the internal `SchemaRunner` (`src/core/schema/runner.ts`) leases a fresh carrier per record parse. Installing the identical host is idempotent; installing a different host after the first is a deterministic `VeliteError('internal')`. The host owns NO Builder, epoch, content execution, journal, broker, generation, reader, publication, cache, registry, or lifecycle state.

The public accessor exposes only the eight-field `SchemaContext`: scoped metadata and its existing record-bound capability closures, not an injectable service collection. The public view and private leased carrier are distinct runtime objects; no private field or symbol appears in `Reflect.ownKeys(context())`. Preserve explicit imports, typed dependencies, explicit construction, and static typing rather than runtime scanning, registration, decorators, reflection, or hidden global containers.

## Authorized runtime exception: schema Promise observation

For asynchronous schema abandonment, late rejection or runner runtime wiring, read [ADR 0003](../../adr/0003-observe-scoped-schema-promises.md). The runner receives a private typed observation capability through explicit DI. Its Node adapter may use one lazily created process-lifetime default hook plus scoped async propagation to observe native descendants, including work settling after the lease closes. This authorized platform mechanism is separate from the host and preserves original Promise outcomes/native schema behavior; it is not a service locator, scheduling policy or process-wide stage pointer. Runtime markers/bookkeeping retain no record/content/build references, and no capability appears in public contexts, exports or declarations.

The composition root explicitly binds observer bookkeeping to an unbound nested host propagation scope (`host.run(undefined, operation)`), masking the record carrier as well as the observer marker. Actual schema callbacks keep their original carrier. The host remains propagation-only; this is not a reset or lifecycle protocol.

## Record-scoped content executions

For content APIs, ownership, plugin continuation, or semantic values, read [ADR 0001](../../adr/0001-share-semantic-content-results.md) and [ADR 0002](../../adr/0002-content-definition-and-anchor-contract.md). `src/core/content/execution/` implements that contract. The former pristine-parse/profile-equivalence/seed guidance is superseded; historical clauses and dated migration caveats remain evidence, not an active second execution path. Unrelated build/publication decisions and necessary transaction gates remain unchanged.

- **Deep module**: one internal record-scoped module owns definition/input lookup, effective options, dialect selection, exclusively owned processor/tree/file continuations, stage success/rejection, bounded source/navigation snapshots, stage journals, diagnostic handoff, and terminal close. Callers request finite semantic selections, not slots, seeds, branches, clone policies, or phase cursors.
- **Factory DI**: assemble dependency/state/lifecycle owners explicitly at the existing pipeline/validate composition roots. Inject the dialect adapters and required capabilities through typed factory dependencies. Adapters own processor assembly and local dependency typing/compatibility; Markdown and MDX share orchestration and semantic contracts, not a mandatory parser or AST. Pure extraction/value algorithms and definition/result-schema factories need no artificial DI wrapper.
- **Identity and lifetime**: reuse requires the same Content Definition and exact selected text in one actual record-validation attempt. Separate factory calls remain independent even with identical options. No structural profile comparison, plugin-ID registry, or hashing-based equivalence survives. A definition may outlive a record, but its execution state may not. Validation opens the module and closes it in its outer `finally`; reload replaces epoch-owned configuration/pipeline, not the process host or the injected stateless host-bound factory. Each new owner resolves options from its own configuration snapshot.
- **Fixed demands**: Parse serves Source Analysis; complete Transform serves Navigation TOC; Emit serves generated content. Reuse pending and settled stage outcomes, continue one ordinary processor, and retain failures without retry. Complete MDX Transform includes recma even for TOC-only demand. Preserve successful lower stages when a later stage fails. Follow legal tree/file replacements and normal compiler/file handling.
- **Ownership, not copying**: capture bounded source facts before mutation and provisional navigation while the transformed content tree exists. Keep opaque plugin state on the owned execution without cloneability restrictions or arbitrary recursive freezing. Share only detached public semantic results; each array/object delivery is fresh. Do not reconstruct closures/VFiles through pristine artifacts or immutable seeds.
- **Effects and diagnostics**: active-stage journals make successful declarations eligible once per execution, discard failed-stage declarations, and defer commitment to valid-record/cross-record/build transactions. Captured capability closures resolve the active stage when called. Shared warnings have record/execution provenance; field-local failures retain their own Zod paths. See `error-handling.md` for the ordinary-issue versus directly thrown invariant boundary.
- **Terminal cleanup**: reject recursive demands on their own pending stage/ancestor and use after close. Close is idempotent and prevents late settlement from starting work, promoting declarations, or repopulating state. Release owned continuations, snapshots, and journals; completed promises must not retain obsolete raw trees/files. No content state enters the process host, Engine graph, `ContentFile`, or `SessionStore`.
- **Public boundary**: the Content Definition API is finite and separate from Zod. `context()` retains exactly its eight public fields, with no public content service. Processor/tree/file, adapters, private requests/carriers, memo keys, journals, phase cursors, and lifecycle controls remain absent from root exports, public declarations, export maps, public contexts, and reflection. No general projection protocol, no-share marker, public registry, or process/cross-record cache is introduced.
- **Single public contract**: `content.markdown()` provides `html`, `toc`, `excerpt`, and `metadata` result schemas; `content.mdx()` provides `code` and the same navigation/source selections. `s` retains Zod and other built-ins, without legacy content roots or standalone projections. No compatibility broker, alternate family, method placeholders, or structural-sharing path remains. Implemented methods do not by themselves imply release acceptance or universal plugin compatibility.
