# Schema Context

`context()` (`src/core/schema/context.ts`) is the controlled ambient accessor that returns the eight-field public `SchemaContext` for the record currently being parsed. It is the one intentional exception to factory DI (see `module-architecture.md`).

## Why it exists

Zod's async transform callback signature `(value, ctx) => ...` forbids passing ambient context explicitly. Built-in and user-defined schemas both need file/record/project/asset metadata during parsing, so a process-owned `SchemaContextHost` (`src/core/schema/host.ts`) propagates the `SchemaRunContext` through async transforms. The default Node runtime composition root (`builder()`/`build()`/`watch()` in `src/index.ts`) installs the host exactly once per process; the internal `SchemaRunner` (`src/core/schema/runner.ts`) leases a fresh carrier per record parse.

## What it carries

`SchemaContext` has exactly eight fields — no internal-only tier:

| Field           | Type                                       | Purpose                                                                                                     |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `project`       | `ProjectInfo`                              | Resolved config snapshot: root, configPath, collections, output, markdown/mdx options                       |
| `file`          | `ContentFile`                              | Current source file: id, path, content (mdast/hast/plain removed; custom schemas own their parser)          |
| `record`        | `ContentRecord`                            | Identity within a multi-record source: id, key, index                                                       |
| `store`         | `SessionStore`                             | Session-scoped key/value store for advanced custom schemas (shared across rebuilds, reset on config reload) |
| `collectEffect` | `(effect, context) => void`                | Declare a schema effect; new calls use the two-arg declaration surface                                      |
| `asset`         | `(key, request?) => Promise<AssetResult>`  | Resolve an asset by content-root-relative POSIX path; memoized; returns publicUrl + optional image metadata |
| `readFile`      | `(absPath) => Promise<Uint8Array>`         | Read asset bytes directly (used by `s.image({ absoluteRoot })`)                                             |
| `probeImage`    | `(bytes, blur?) => Promise<ImageMetadata>` | Probe + blur image bytes directly, bypassing the asset pipeline                                             |

All fields are accessible to both built-in and user-defined schemas; there is no internal-only tier. The private record-bound content capability is a separate runtime object reachable only by Velite-owned result-schema implementations through the leased `SchemaRunContext`. The public view and carrier are different objects; no hidden property or symbol attaches the capability to `context()`.

## Rules

**Correct** — read execution-scoped metadata from `context()`:

```ts
const { project, file, record } = context()
const { publicUrl, width, height } = await context().asset('./img/hero.png')
```

**Incorrect** — never treat `context()` as a service locator. It carries metadata and capability closures for the current parse, not injectable services:

```ts
// wrong — context() is not a DI container
const logger = context().logger
const fs = context().fs
```

`context()` throws `VeliteError('internal', ...)` when called outside of a schema parse (no bound execution context) or after the active run has settled (late call).

## Process-owned host

`SchemaContextHost` (`src/core/schema/host.ts`) is the sole ambient architecture exception. Installing the identical host is idempotent; installing a different host after the first is a deterministic `VeliteError('internal')`. There is no reset, replacement, reference-counting, or disposal protocol — the host's lifetime is the process lifetime. The host owns NO Builder, epoch, content execution, journal, broker, generation, reader, publication, cache, registry, or lifecycle state; it only propagates the current `SchemaRunContext` and rejects missing or inactive leased carriers.

## Content execution boundary

For Content Definitions, source selections, navigation, or plugin processing, follow [ADR 0001](../../.adr/0001-share-semantic-content-results.md) and the exact [ADR 0002 contract](../../.adr/0002-content-definition-and-anchor-contract.md), implemented in `src/core/content/execution/`. The former logical-continuity-through-pristine-seeds contract is superseded; historical reasoning remains evidence rather than active ownership guidance.

- Same-definition/exact-selected-input demands share one exclusively owned execution within one actual record-validation attempt. Separately created definitions remain independent. The module, not the ambient host/public view, owns processor/tree/file and stage outcomes; all construction is explicit factory DI.
- Parse captures Source Analysis before mutations; complete Transform captures Navigation TOC, including MDX recma; Emit generates HTML/code. Source-only selections skip returned transformers/compilers, while TOC-only skips only serialization/minification. Late selections reuse bounded semantic snapshots, not a pristine tree exposed to callers.
- Preserve ordinary closures, opaque private state, legal replacement trees/VFiles, compiler values/results, and messages on the owned continuation. Do not copy seed graphs, freeze arbitrary plugin values, or impose cloneability-based compatibility diagnostics. Public DTOs are detached per delivery; custom schemas can compose result schemas as black boxes without gaining shared AST/VFile access.
- Record-bound closures captured during initialization must resolve the active execution/stage scope when invoked, including asynchronous callbacks. Successful-stage declarations become eligible once; failed-stage declarations are discarded; invalid records discard every sibling effect. Existing cross-record/build gates still decide commitment. Direct plugin external I/O is not rollbackable.
- The runner closes its lease at schema settlement; validation closes the content module in its outer cleanup. Missing/inactive context, recursive pending demands, and late capability use remain internal faults. Late settlement cannot start work, reopen journals, promote declarations, or retain content state in the host/store/file model.
- [ADR 0003](../../.adr/0003-observe-scoped-schema-promises.md) authorizes a separate explicitly injected runtime observer for native schema Promise chains that Zod can abandon. Observation preserves rejections for actual waiters and can follow already-originating late descendants without extending the lease. Its runtime marker carries no record/content state; the host remains propagation-only and `context()` retains exactly eight fields.
- Private `host.run(undefined, operation)` masks the schema carrier for observer bookkeeping only, restoring the outer carrier afterward. The composition root injects that unbound operation into the Node observer; masking the observer marker alone would still inherit host ALS references. Actual schema/plugin work and independently retained pending work keep their ordinary contexts.
- The finite `content.markdown` / `content.mdx` definition API returns ordinary Zod result schemas, separate from `s`. No public context content field, processor registry, generic demand/projection protocol, cache controls, lifecycle API, or legacy content alias exists. Native wrappers do not schedule stages; actual inner requests drive work, and explicit input preprocessing expresses conditional derivation.

## SessionStore

`store` is a session-scoped `Map`-backed key/value store (`get` / `has` / `getOrCreate`). It is shared across rebuilds inside a watch session, destroyed at the end of a one-shot build, and reset on config reload. There is deliberately no `set()` — built-in cross-file schemas use the effects model (`collectEffect` → emit aggregation) so concurrent validation stays deterministic. Use `store` when a custom schema needs lazily-initialised shared state.
