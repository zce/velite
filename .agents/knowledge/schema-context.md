# Schema Context

`context()` (`src/core/schema/context.ts:210`) is the controlled ambient accessor that returns the `SchemaContext` for the record currently being parsed. It is the one intentional exception to factory DI (see `module-architecture.md`).

## Why it exists

Zod's async transform callback signature `(value, ctx) => ...` forbids passing ambient context explicitly. Built-in and user-defined schemas both need file/record/project/asset metadata during parsing, so a late-bound `ContextStorage` (`src/runtime/contextual.ts`) propagates the `SchemaContext` through async transforms. The composition root (`createBuilder` in `src/core/builder.ts`) calls `installContextStorage` exactly once per process; `runWithContext` (`src/core/schema/context.ts:219`) binds a fresh context per record parse.

## What it carries

`SchemaContext` (`src/core/schema/context.ts:97-132`) has exactly these fields — no internal-only tier:

| Field           | Type                                       | Purpose                                                                                                     |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `project`       | `ProjectInfo`                              | Resolved config snapshot: root, configPath, collections, output, markdown/mdx options                       |
| `file`          | `ContentFile`                              | Current source file: id, path, content, plain, lazily-parsed mdast/hast                                     |
| `record`        | `ContentRecord`                            | Identity within a multi-record source: id, key, index                                                       |
| `store`         | `SessionStore`                             | Session-scoped key/value store for advanced custom schemas (shared across rebuilds, reset on config reload) |
| `collectEffect` | `(effect: Effect) => void`                 | Declare a schema effect (unique registration, asset reference)                                              |
| `asset`         | `(key, request?) => Promise<AssetResult>`  | Resolve an asset by content-root-relative POSIX path; memoized; returns publicUrl + optional image metadata |
| `readFile`      | `(absPath) => Promise<Uint8Array>`         | Read asset bytes directly (used by `s.image({ absoluteRoot })`)                                             |
| `probeImage`    | `(bytes, blur?) => Promise<ImageMetadata>` | Probe + blur image bytes directly, bypassing the asset pipeline                                             |

All fields are accessible to both built-in and user-defined schemas — there is no internal-only tier.

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

`context()` throws `VeliteError('internal', ...)` when called outside of a schema parse (no bound execution context). Use `tryCtx()`-equivalent (`schemaContext.tryGet()`) only when absence is valid — built-in schemas never need this.

## SessionStore

`store` is a session-scoped `Map`-backed key/value store (`get` / `has` / `getOrCreate`). It is shared across rebuilds inside a watch session, destroyed at the end of a one-shot build, and reset on config reload. There is deliberately no `set()` — built-in cross-file schemas use the effects model (`collectEffect` → `uniqueCheck`) so concurrent validation stays deterministic. Use `store` when a custom schema needs lazily-initialised shared state.
