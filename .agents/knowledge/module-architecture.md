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

The composition roots in this repo: `createBuilder` (`src/core/builder.ts`, internal — not a root export), `createPipeline` (`src/core/pipeline/index.ts`), the public `builder`/`build`/`watch` facades (`src/index.ts`), `createRunContext` + `createDriver` (`src/core/driver.ts`), `createSchemaRunner` + `ensureHostInstalled` (`src/core/schema/runner.ts`, installs/obtains the process-owned `SchemaContextHost`), `createScheduler` (`src/core/scheduler.ts`), and `createContentArtifactsFactory` (`src/core/schema/derivation/broker.ts`, the record-scoped content derivation module factory wired into the pipeline composition root).

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

`context()` (`src/core/schema/context.ts`) is the one intentional piece of hidden global state in core. Zod's transform callback signature `(value, ctx) => ...` forbids passing ambient context explicitly, so a process-owned `SchemaContextHost` (`src/core/schema/host.ts`, see `schema-context.md`) propagates the `SchemaRunContext` through async transforms. The default Node runtime composition root (`builder()`/`build()`/`watch()` in `src/index.ts`) installs the host exactly once per process; the internal `SchemaRunner` (`src/core/schema/runner.ts`) leases a fresh carrier per record parse. Installing the identical host is idempotent; installing a different host after the first is a deterministic `VeliteError('internal')`. The host owns NO Builder, epoch, broker, generation, reader, publication, cache, registry, or lifecycle state.

It must only expose execution-scoped metadata (the current eight-field `SchemaContext`), never services. This is metadata-only, consistent with the explicit-over-magic principle: explicit imports, explicit dependencies, explicit construction, static typing. Avoid runtime scanning, automatic registration, decorators, reflection, and hidden global containers.

## Record-scoped content derivation module

The record-scoped content derivation module (`src/core/schema/derivation/`) is an explicitly assembled, record-scoped **Content Artifact Broker** that coalesces matching pristine parses and isolates every demanded transform branch. It is created as part of the pipeline epoch, opened once for each record validation by `validate`, and disposed in an outer `finally` after that validation attempt completes.

- **Factory DI**: `createContentArtifactsFactory(deps)` receives the dialect adapter pair as an explicit dependency. `createDefaultContentArtifactsFactory()` is the composition-root convenience. The broker owns state (slots, in-flight promises, retained artifacts) and the adapters own dialect-specific parse/materialize logic. No public adapter registry, no hidden singleton, no IoC container.
- **Internal types**: `PristineArtifact`, `VFileSeed`, `ParseMessageSeed`, `ContentDialectAdapter`, `ContentBranch`, `RecordBroker`, `ContentArtifactsFactory`, `ParseIdentity`, `ProfileIdentity`, `OpaquePristineTree`, `OpaqueBranchTree`, `RecordScope`, and the seed copier are all internal — they MUST NOT appear in root package exports, built public declarations, export map, runtime reflection, `SchemaContext`, `ContentFile`, or any custom projection protocol.
- **Epoch ownership**: the factory and adapters belong to one pipeline/configuration epoch. A fresh broker is opened per record; no broker artifact crosses record or epoch boundaries. A config reload creates a new pipeline, factory, profile namespace, session store, and record brokers.
- **Pristine parsing, seed ownership, and branch materialization** are internal responsibilities of the explicitly assembled Markdown/MDX dialect adapters. The parse VFile never enters a transforming branch; every transforming branch receives a fresh tree + fresh VFile materialized from the seed; the exact same branch VFile is passed through all remark/rehype/recma/run/stringify/compile phases in that branch.
- **No no-share marker**: Velite adds no public or internal no-share/uncached marker, does not inspect plugin closure state, does not infer eligibility from function names or identities beyond profile equality, and does not probe by executing a parser twice. Matching exact profiles always use the mandatory parse slot. A parser plugin that violates the deterministic/reentrant responsibility has documented unsupported behavior.
