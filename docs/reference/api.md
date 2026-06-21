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
const build: <T extends Collections = Collections>(options?: BuildOptions) => Promise<BuildResult<T>>
```

### Parameters

#### `options`

- Type: `BuildOptions`, See [BuildOptions](#buildoptions).

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

#### `options.logger`

- Type: `Logger`

Inject a custom logger (framework integrations / tests). Diagnostics remain the structured error model.

#### `options.signal`

- Type: `AbortSignal`

Abort the in-flight build run. An aborted run never commits candidate state.

### Returns

- Type: `Promise<BuildResult<T>>`, See [BuildResult](./types.md#buildresult).

The build result. On failure the promise rejects with a [`VeliteError`](#veliteerror) carrying the structured diagnostics.

### Types

#### BuildOptions

```ts
interface BuildOptions {
  /** Config file path (relative to cwd). Auto-discovered when omitted. */
  config?: string
  /** Clean output directories before build. @default false */
  clean?: boolean
  /** Throw on any schema validation failure. @default false */
  strict?: boolean
  /** Log level. @default 'info' */
  logLevel?: LogLevel
  /** Working directory for embedded calls. @default process.cwd() */
  cwd?: string
  /** Inject a custom logger. */
  logger?: Logger
  /** Abort the in-flight build run. */
  signal?: AbortSignal
}
```

Pass a collections type parameter when you want a strongly typed programmatic build result.

## `watch`

Build your project once, then watch files and rebuild on changes. Returns a watcher handle that programmatic callers can close. Watch failures do not auto-close the watcher.

### Usage

```ts
import { watch } from 'velite'
```

### Signature

```ts
const watch: <TCollections extends Collections = Collections>(options?: WatchOptions) => Promise<Watcher<TCollections>>
```

### Parameters

#### `options`

- Type: `WatchOptions`, extends [BuildOptions](#buildoptions).

Options for the initial build and watcher.

#### `options.onBuild`

- Type: `(event: WatchBuildEvent) => void | Promise<void>`

Observer callback invoked after each build run (initial and rebuilds). This is an integration-friendly observer, not a pipeline hook.

### Returns

- Type: `Promise<Watcher<TCollections>>`.

The watcher handle.

```ts
interface Watcher<TCollections extends Collections = Collections> {
  readonly closed: boolean
  close(): Promise<void>
}
```

`close()` stops accepting new file events and waits for the in-flight build run to finish or roll back before returning.

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
type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown' | (string & {})

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
