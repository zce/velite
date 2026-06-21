import { diagnostic } from './diagnostic'

import type { Diagnostic } from './diagnostic'
import type { Path } from './host/path'
import type { Schema } from './schema/s'

/** A collection definition as written by the user. */
export interface CollectionDef<S extends Schema = Schema> {
  /** Glob pattern(s), relative to the content root. */
  pattern: string | string[]
  /** Patterns to exclude. */
  exclude?: string | string[]
  /** Single-item output (one entry) instead of a list. */
  single?: boolean
  /** Per-entry schema. */
  schema: S
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
  }
  /** Collections keyed by name (the name is also the output data key). */
  collections: Record<string, CollectionDef>
}

export interface ResolvedCollection {
  name: string
  include: string[]
  exclude: string[]
  single: boolean
  schema: Schema
}

export interface ResolvedConfig {
  /** Absolute, posix content root. */
  root: string
  /** Absolute path to the config file (empty when synthetic). */
  configPath: string
  output: { data: string; assets: string; base: string; name: string }
  collections: ResolvedCollection[]
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
      name: config.output?.name ?? 'static'
    },
    collections: Object.entries(config.collections).map(([name, def]) => ({
      name,
      include: toArray(def.pattern),
      exclude: toArray(def.exclude),
      single: def.single ?? false,
      schema: def.schema
    }))
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
