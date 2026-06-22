import { diagnostic } from './diagnostic'

import type { Path } from '../runtime/path'
import type { Diagnostic } from './diagnostic'
import type { LogicalOutput } from './output/logical'
import type { Schema } from './schema/s'

/** A collection definition as written by the user. */
export interface CollectionDef<S extends Schema = Schema> {
  /** Glob pattern(s), relative to the content root. */
  pattern: string | string[]
  /** Patterns to exclude. */
  exclude?: string | string[]
  /** Single-item output (one entry) instead of a list. */
  single?: boolean
  /** Generated TypeScript type name (defaults to the collection key). */
  typeName?: string
  /** Per-entry schema. */
  schema: S
}

/** Result of the `prepare` hook: continue, skip output, or replace the result. */
export type PrepareResult = void | false | { output: LogicalOutput; diagnostics: Diagnostic[] }

/** A `T | Promise<T>` helper (kept local to avoid importing the old loaders). */
type Promisable<T> = T | Promise<T>

/**
 * The output-oriented `prepare` hook.
 *
 * Receives the complete logical build result (`{output, diagnostics}`) and may
 * mutate it in place (returning `void`), replace it (returning a new
 * `{output, diagnostics}`), or skip default output (returning `false`). Partial
 * patch returns are not supported.
 */
export type PrepareHook = (result: { output: LogicalOutput; diagnostics: Diagnostic[] }, context: PrepareContext) => Promisable<PrepareResult>

/** Context passed to the `prepare` hook. */
export interface PrepareContext {
  readonly project: {
    readonly root: string
    readonly configPath: string
    readonly collections: readonly ResolvedCollection[]
  }
  readonly diagnostics: readonly Diagnostic[]
}

export interface UserConfig {
  /** Content root, relative to the project (default '.'). */
  root?: string
  output?: {
    /** Directory for generated data, relative to the project (default '.velite'). */
    data?: string
    /** Directory for generated assets, relative to the project (default 'public/static'). */
    assets?: string
    /** Public base url for assets (default '/static/'). */
    base?: string
    /** Asset sub-directory name within the asset dir (default 'static'). */
    name?: string
    /** Output entry file format (default 'esm'). */
    format?: 'esm' | 'cjs'
  }
  /** Collections keyed by name (the name is also the output data key). */
  collections: Record<string, CollectionDef>
  /** Output-oriented result-processing hook, applied between emit and write. */
  prepare?: PrepareHook
}

export interface ResolvedCollection {
  name: string
  include: string[]
  exclude: string[]
  single: boolean
  /** Resolved type name (user value or the collection key). */
  typeName: string
  schema: Schema
}

export interface ResolvedConfig {
  /** Absolute, posix content root. */
  root: string
  /** Absolute path to the config file (empty when synthetic). */
  configPath: string
  output: { data: string; assets: string; base: string; name: string; format: 'esm' | 'cjs' }
  collections: ResolvedCollection[]
  /** Carried through from UserConfig; applied by the driver. */
  prepare?: PrepareHook
}

/** Identity helper for type inference and editor support. No runtime effect. */
export const defineConfig = (config: UserConfig): UserConfig => config

/** Identity helper for a single collection, for type inference. */
export const defineCollection = <S extends Schema>(def: CollectionDef<S>): CollectionDef<S> => def

const toArray = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value])

/** Resolve a user config into absolute paths and a normalized shape (pure). */
export const resolveConfig = (config: UserConfig, options: { cwd: string; path: Path; configPath?: string }): ResolvedConfig => {
  const { cwd, path } = options
  return {
    root: path.join(cwd, config.root ?? '.'),
    configPath: options.configPath ?? '',
    output: {
      data: path.join(cwd, config.output?.data ?? '.velite'),
      assets: path.join(cwd, config.output?.assets ?? 'public/static'),
      base: config.output?.base ?? '/static/',
      name: config.output?.name ?? 'static',
      format: config.output?.format ?? 'esm'
    },
    collections: Object.entries(config.collections).map(([name, def]) => ({
      name,
      include: toArray(def.pattern),
      exclude: toArray(def.exclude),
      single: def.single ?? false,
      typeName: def.typeName ?? name,
      schema: def.schema
    })),
    prepare: config.prepare
  }
}

/** Validate a raw config value's shape. Returns diagnostics (does not throw). */
export const validateConfig = (config: unknown): Diagnostic[] => {
  if (typeof config !== 'object' || config === null) {
    return [diagnostic('error', 'CONFIG_INVALID', 'config must be an object')]
  }
  const collections = (config as UserConfig).collections
  if (typeof collections !== 'object' || collections === null) {
    return [diagnostic('error', 'CONFIG_INVALID', 'config.collections must be an object')]
  }
  const issues: Diagnostic[] = []
  for (const [name, def] of Object.entries(collections)) {
    if (def == null || (def as CollectionDef).pattern == null) {
      issues.push(diagnostic('error', 'CONFIG_INVALID', `collection "${name}" is missing a pattern`, { collection: name }))
    }
    if (def == null || (def as CollectionDef).schema == null) {
      issues.push(diagnostic('error', 'CONFIG_INVALID', `collection "${name}" is missing a schema`, { collection: name }))
    }
  }
  return issues
}
