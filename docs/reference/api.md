---
outline: deep
---

# API Reference

## `build`

Build your project.

### Usage

```ts
import { build } from 'velite'
```

### Signature

```ts
const build: (options?: BuildEntryOptions) => Promise<BuildResult>
```

### Parameters

#### `options`

- Type: `BuildEntryOptions`, See [BuildEntryOptions](#buildentryoptions).

Options for build.

#### `options.config`

- Type: `string`

Specify the config file path.

#### `options.clean`

- Type: `boolean`
- Default: `false`

Clean output directories before build.

#### `options.logLevel`

- Type: `'debug' | 'info' | 'warn' | 'error' | 'silent'`
- Default: `'info'`

Log level.

#### `options.strict`

- Type: `boolean`
- Default: `false`

If true, throws an error and terminates the process if any schema validation fails. Otherwise, a warning is logged but the process does not terminate.

#### `options.cwd`

- Type: `string`
- Default: `process.cwd()`

Working directory for embedded calls and config discovery.

#### `options.layout`

- Type: `'split' | 'single'`
- Default: `split` in development, `single` in production (`NODE_ENV=production`)

Physical output layout. `split` writes one file per record (dev-friendly); `single` writes one file per collection (production).

### Returns

- Type: `Promise<BuildResult>`, See [BuildResult](./types.md#buildresult).

The build result (`output`, `diagnostics`, `written`). On failure the promise rejects with a [`VeliteError`](#veliteerror) carrying the structured diagnostics.

### Types

#### BuildEntryOptions

```ts
interface BuildEntryOptions {
  /** Config file path (relative to cwd or absolute). Auto-discovered when omitted. */
  config?: string
  /** Output layout. @default 'split' in dev, 'single' in production */
  layout?: 'split' | 'single'
  /** Clean output directories before build. @default false */
  clean?: boolean
  /** Throw a VeliteError on any error-level diagnostic. @default false */
  strict?: boolean
  /** Console logger verbosity. @default 'info' */
  logLevel?: LogLevel
  /** Working directory for embedded calls and config discovery. @default process.cwd() */
  cwd?: string
}
```

## `watch`

Build your project once, then watch files and rebuild on changes. Returns a watcher handle that programmatic callers can close. Watch failures do not auto-close the watcher.

### Usage

```ts
import { watch } from 'velite'
```

### Signature

```ts
const watch: (options?: BuildEntryOptions) => Promise<WatchHandle>
```

### Parameters

#### `options`

- Type: `BuildEntryOptions`, See [BuildEntryOptions](#buildentryoptions).

Options for the initial build and watcher. Accepts the same options as [`build`](#build).

### Returns

- Type: `Promise<WatchHandle>`.

The watcher handle. The single initial build runs before `watch()` resolves, and its result is exposed on `handle.initial` so callers don't trigger a second build. Closing the handle disposes the underlying builder.

```ts
interface WatchHandle {
  /** Result of the one initial build run before the watcher subscribed. */
  initial: BuildResult
  close(): Promise<void>
}
```

## `defineConfig`

Identity helper for the top-level Velite config. Returns its input unchanged; exists so editors can infer types from a typed config literal without a manual `satisfies UserConfig`.

```ts
import { defineConfig } from 'velite'

const defineConfig: (config: UserConfig) => UserConfig
```

## `defineCollection`

Identity helper for a single collection definition. Pairs with `defineConfig` for tighter per-collection type inference.

```ts
import { defineCollection } from 'velite'

const defineCollection: <S extends Schema>(def: CollectionDef<S>) => CollectionDef<S>
```

## `defineLoader`

Identity helper for a custom loader. See [Custom Loaders](../guide/custom-loader.md) for end-to-end examples.

```ts
import { defineLoader } from 'velite'

const defineLoader: <L extends Loader>(loader: L) => L
```

## `defineSchema`

Identity helper for a reusable custom schema. Useful when extracting a schema definition that the type inference cannot follow back to its declaration.

```ts
import { defineSchema } from 'velite'

const defineSchema: <S extends Schema>(schema: S) => S
```

## `context`

Get the current schema context while Velite is parsing a schema.

### Usage

```ts
import { context } from 'velite'
```

### Signature

```ts
const context: () => SchemaContext
```

### Returns

- Type: `SchemaContext`, See [SchemaContext](./types.md#schemacontext).

The schema context contains the project info, current file, current record, and session-scoped store. Call `context()` inside schema callbacks such as `.transform()`, `.refine()`, or `.superRefine()`.

## `VeliteError`

The error type thrown by `build()` / `watch()` when a build run fails, and by internal `fail()` / `assert()` calls for invariant violations.

```ts
type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown'

class VeliteError<T = unknown> extends Error {
  readonly code: VeliteErrorCode
  readonly context?: T
  readonly diagnostics: Diagnostic[]
  constructor(code: VeliteErrorCode, options?: { message?: string; context?: T; cause?: unknown; diagnostics?: Diagnostic[] })
  toString(): string
  toJSON(): object
}
```

The `code` aligns with pipeline stages (`DiagnosticStage`) plus `internal` (invariant violations) and `unknown` (fallback). Programmatic callers can use `instanceof VeliteError`, read `error.code`, and read `error.diagnostics` (populated when the error represents a build failure).

> **Breaking change:** the constructor signature changed from `new VeliteError(message, diagnostics)` to `new VeliteError(code, options)`.
