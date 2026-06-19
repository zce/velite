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
const build: (options?: BuildOptions) => Promise<BuildResult>
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

#### `options.watch`

- Type: `boolean`
- Default: `false`

Watch files and rebuild on changes.

For programmatic watch mode, prefer [`watch()`](#watch) so you can close the returned watcher handle. `build({ watch: true })` preserves the historical build facade behavior and still returns only the initial build result.

<!-- #### `options.production`

- Type: `boolean`
- Default: `false`

Whether to build in production mode. -->

#### `options.logLevel`

- Type: `'debug' | 'info' | 'warn' | 'error' | 'silent'`
- Default: `'info'`

Log level.

#### `options.strict`

- Type: `boolean`
- Default: `false`

If true, throws an error and terminates the process if any schema validation fails. Otherwise, a warning is logged but the process does not terminate.

### Returns

- Type: `Promise<BuildResult>`, See [BuildResult](#buildresult).

The build result.

### Types

#### BuildOptions

```ts
interface BuildOptions {
  /**
   * Specify config file path
   * @default 'velite.config.{js,ts,mjs,mts,cjs,cts}'
   */
  config?: string
  /**
   * Clean output directories before build
   * @default false
   */
  clean?: boolean
  /**
   * Watch files and rebuild on changes
   * @default false
   */
  watch?: boolean
  /**
   * Log level
   * @default 'info'
   */
  logLevel?: LogLevel
  /**
   * If true, throws error and terminates process if any schema validation fails.
   * @default false
   */
  strict?: boolean
}
```

#### BuildResult

```ts
interface Entry {
  [key: string]: any
}

/**
 * build result, may be one or more entries in a document file
 */
interface BuildResult {
  [name: string]: Entry | Entry[]
}
```

## `watch`

Build your project once, then watch files and rebuild on changes. Unlike `build({ watch: true })`, this API returns a watcher handle that programmatic callers can close.

### Usage

```ts
import { watch } from 'velite'
```

### Signature

```ts
const watch: (options?: BuildOptions) => Promise<Watcher>
```

### Parameters

#### `options`

- Type: `BuildOptions`, See [BuildOptions](#buildoptions).

Options for the initial build and watcher.

### Returns

- Type: `Promise<Watcher>`.

The watcher handle.

```ts
interface Watcher {
  close(): Promise<void>
}
```

## `context`

Get the current build context while Velite is parsing a schema.

### Usage

```ts
import { context } from 'velite'
```

### Signature

```ts
const context: () => BuildContext
```

### Returns

- Type: `BuildContext`, See [BuildContext](./types.md#buildcontext).

The build context contains the resolved config, current file, and build-scoped store. Call `context()` inside schema callbacks such as `.transform()`, `.refine()`, or `.superRefine()`.
