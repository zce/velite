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
| `collectEffect` | `(effect, context) => void`                | Declare a schema effect (Ticket 23 two-arg surface; legacy single-arg during Phase 1-3 migration)           |
| `asset`         | `(key, request?) => Promise<AssetResult>`  | Resolve an asset by content-root-relative POSIX path; memoized; returns publicUrl + optional image metadata |
| `readFile`      | `(absPath) => Promise<Uint8Array>`         | Read asset bytes directly (used by `s.image({ absoluteRoot })`)                                             |
| `probeImage`    | `(bytes, blur?) => Promise<ImageMetadata>` | Probe + blur image bytes directly, bypassing the asset pipeline                                             |

All fields are accessible to both built-in and user-defined schemas; there is no internal-only tier. The private record-bound `content(request)` capability is a separate runtime object reachable only by Velite-owned roots through the leased `SchemaRunContext`.

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

`SchemaContextHost` (`src/core/schema/host.ts`) is the sole ambient architecture exception. Installing the identical host is idempotent; installing a different host after the first is a deterministic `VeliteError('internal')`. There is no reset, replacement, reference-counting, or disposal protocol — the host's lifetime is the process lifetime. The host owns NO Builder, epoch, broker, generation, reader, publication, cache, registry, or lifecycle state; it only propagates the current `SchemaRunContext` and rejects missing or inactive leased carriers.

## SessionStore

`store` is a session-scoped `Map`-backed key/value store (`get` / `has` / `getOrCreate`). It is shared across rebuilds inside a watch session, destroyed at the end of a one-shot build, and reset on config reload. There is deliberately no `set()` — built-in cross-file schemas use the effects model (`collectEffect` → `uniqueCheck`) so concurrent validation stays deterministic. Use `store` when a custom schema needs lazily-initialised shared state.
