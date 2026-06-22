// Default Node entry-point for the `velite` package.
//
// This is the end-user surface: `build()` / `watch()` (one-shot or long-lived
// pipelines against the default Node runtime), the identity helpers used by a
// `velite.config.ts` (`defineConfig`, `defineCollection`), the schema namespace
// `s`, and the types you'd read off a build result or write into a `prepare`
// hook. Anything an adapter author or framework integrator needs (the
// `Runtime` ports, `createBuilder`, the node adapter, the scheduler, …) lives
// under `velite/runtime` instead — see `src/runtime.ts`.

import { createBuilder } from './core'
import { join } from './core/util/path'
import { nodeRuntime } from './runtime/adapters/node'

import type { Builder, BuildResult, WatchHandle } from './core'

export interface BuildEntryOptions {
  /** Project directory (default: process.cwd()). */
  cwd?: string
  /** Config path (relative to cwd or absolute). Default: auto-detect velite.config.*. */
  config?: string
  /** Output layout (default: `single` in production, `split` otherwise). */
  layout?: 'split' | 'single'
}

const resolveConfigOption = (cwd: string, explicit: string | undefined): string | undefined => {
  if (explicit === undefined) return undefined
  // Pass through as-is when already absolute (posix or windows). The Node fs
  // adapter normalizes platform separators at the I/O boundary; here we just
  // need to know whether the user supplied an absolute path so we don't join
  // it with cwd.
  if (explicit.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(explicit)) return explicit
  return join(cwd, explicit)
}

/**
 * Create a durable Node builder. Advanced/stateful entry — most users want
 * `build()` or `watch()` below. Exposed here (rather than only under
 * `velite/runtime`) because the existing API surface has historically wired
 * builders against the default Node runtime; for non-Node runtimes use
 * `createBuilder` from `velite/runtime` and supply your own `Runtime`.
 */
export const builder = (options: BuildEntryOptions = {}): Builder => {
  const cwd = options.cwd ?? process.cwd()
  return createBuilder(nodeRuntime, { cwd, configPath: resolveConfigOption(cwd, options.config) })
}

/** One-shot build with the default Node runtime. */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    return await instance.build({ layout })
  } finally {
    await instance.dispose()
  }
}

/** Watch mode: long-lived builder reacting to file events via the runtime watcher. */
export const watch = async (options: BuildEntryOptions = {}): Promise<WatchHandle> => {
  return builder(options).watch()
}

// Identity helpers and the schema namespace.
export { defineCollection, defineConfig, s } from './core'

// The types a `velite.config.ts` author and a `prepare` hook author need.
// Adapter/extension authors should import advanced surfaces from
// `velite/runtime` instead.
export type {
  BuildResult,
  CollectionDef,
  CollectionResult,
  Diagnostic,
  Entry,
  Infer,
  Loader,
  LogicalOutput,
  PrepareContext,
  PrepareHook,
  PrepareResult,
  ResolvedConfig,
  Schema,
  SchemaNamespace,
  UserConfig,
  WatchHandle
} from './core'
