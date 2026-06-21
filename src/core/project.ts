import { dirname, resolve } from 'node:path'

import { builtinLoaders } from '../loaders'
import { fail } from './errors'

import type { Collections } from '../collections'
import type { OutputConfig, PrepareHook, UserConfig } from '../config'
import type { LoadedConfig } from '../config/load'
import type { Loader } from '../loaders/types'
import type { MarkdownOptions } from '../schemas/markdown'
import type { MdxOptions } from '../schemas/mdx'

/**
 * Config file metadata within a resolved project.
 *
 * `path` is the absolute config file path. `dependencies` lists all files that
 * contributed to the config (for watch invalidation).
 */
export interface ProjectConfig {
  readonly path: string
  readonly dependencies: readonly string[]
}

/**
 * A resolved, immutable project snapshot.
 *
 * `Project` is the fully-resolved view of a user config: absolute paths,
 * merged loaders, resolved output and effective strictness. A config change
 * produces a brand-new `Project`; the old one is never mutated in place.
 */
export interface Project<T extends Collections = Collections> {
  readonly config: ProjectConfig
  readonly root: string
  readonly collections: T
  readonly loaders: readonly Loader[]
  readonly output: ResolvedOutput
  readonly strict: boolean
  readonly markdown?: MarkdownOptions
  readonly mdx?: MdxOptions
  readonly prepare?: PrepareHook<T>
}

/**
 * Resolved output configuration.
 *
 * Combines the public `OutputConfig` (the locked user-facing shape) with the
 * internal asset filename template. The template is an internal physical-output
 * concern and is intentionally not part of the public `OutputConfig`.
 */
export interface ResolvedOutput extends OutputConfig {
  /** Asset filename template, e.g. `[name]-[hash:8].[ext]`. */
  readonly name: string
}

/** Default internal asset filename template. */
const DEFAULT_ASSET_NAME = '[name]-[hash:8].[ext]'

const TYPE_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/
const RESERVED_TYPE_NAMES = new Set<string>([
  'abstract',
  'any',
  'as',
  'asserts',
  'async',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'infer',
  'instanceof',
  'interface',
  'keyof',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'satisfies',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unique',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield'
])

const validateCollections = (collections: Collections): void => {
  for (const [key, collection] of Object.entries(collections)) {
    if (!TYPE_IDENTIFIER_RE.test(key) || RESERVED_TYPE_NAMES.has(key)) {
      fail('config', { message: `collection key '${key}' must be a valid TypeScript identifier`, context: { key } })
    }
    if (!TYPE_IDENTIFIER_RE.test(collection.typeName) || RESERVED_TYPE_NAMES.has(collection.typeName)) {
      fail('config', {
        message: `collection '${key}' typeName '${collection.typeName}' must be a valid TypeScript identifier`,
        context: { key, typeName: collection.typeName }
      })
    }
  }
}

export interface ResolveProjectOptions {
  /** Override `output.clean` from the user config. */
  clean?: boolean
  /** Override `strict` from the user config. */
  strict?: boolean
}

/**
 * Resolve a loaded config into a fully-resolved `Project`.
 *
 * Validates collection keys/typeNames, resolves absolute paths, merges loaders,
 * and applies option overrides. Returns an immutable snapshot.
 */
export const resolveProject = <T extends Collections = Collections>(loaded: LoadedConfig<UserConfig<T>>, options: ResolveProjectOptions = {}): Project<T> => {
  const { config, path: configPath, dependencies } = loaded

  if (config.collections == null) {
    fail('config', { message: `'collections' is required in '${configPath}'`, context: { configPath } })
  }
  validateCollections(config.collections)

  const cwd = dirname(configPath)
  const output = config.output

  return {
    config: { path: configPath, dependencies },
    root: resolve(cwd, config.root ?? 'content'),
    collections: config.collections,
    loaders: [...(config.loaders ?? []), ...builtinLoaders],
    output: {
      data: resolve(cwd, output?.data ?? '.velite'),
      assets: resolve(cwd, output?.assets ?? 'public/static'),
      base: output?.base ?? '/static/',
      name: DEFAULT_ASSET_NAME,
      format: output?.format ?? 'esm',
      clean: options.clean ?? output?.clean ?? false
    },
    strict: options.strict ?? config.strict ?? false,
    markdown: config.markdown,
    mdx: config.mdx,
    prepare: config.prepare
  }
}
