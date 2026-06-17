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
const build: (options?: Options) => Promise<Result>
```

### Parameters

#### `options`

- Type: `Options`, See [Options](#options).

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

- Type: `Promise<Result>`, See [Result](#result).

The build result.

### Types

#### Options

```ts
interface Options {
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

#### Result

```ts
interface Entry {
  [key: string]: any
}

/**
 * build result, may be one or more entries in a document file
 */
interface Result {
  [name: string]: Entry | Entry[]
}
```

## `context`

Get the current parser context while Velite is parsing a schema.

### Usage

```ts
import { context } from 'velite'
```

### Signature

```ts
const context: () => ParserContext
```

### Returns

- Type: `ParserContext`, See [ParserContext](./types.md#parsercontext).

The parser context contains the resolved config and current file. Call `context()` inside schema callbacks such as `.transform()`, `.refine()`, or `.superRefine()`.
