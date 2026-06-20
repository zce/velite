import { createHash } from 'node:crypto'
import { access, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as esbuild } from 'esbuild'

import { name as pkgName } from '../../package.json'
import { builtinLoaders } from '../loaders'
import { logger as defaultLogger } from '../runtime/logger'

import type { Collections } from '../collections'
import type { Project } from '../core/project'
import type { Logger } from '../runtime/logger'
import type { UserConfig } from './index'

const CONFIG_NAMES = [
  `${pkgName}.config.js`,
  `${pkgName}.config.ts`,
  `${pkgName}.config.mjs`,
  `${pkgName}.config.mts`,
  `${pkgName}.config.cjs`,
  `${pkgName}.config.cts`
] as const

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
      throw new Error(`collection key '${key}' must be a valid TypeScript identifier`)
    }
    if (!TYPE_IDENTIFIER_RE.test(collection.typeName) || RESERVED_TYPE_NAMES.has(collection.typeName)) {
      throw new Error(`collection '${key}' typeName '${collection.typeName}' must be a valid TypeScript identifier`)
    }
  }
}

/** Search up to `depth` parent directories for the first matching file. */
const searchFile = async (files: readonly string[], cwd: string = process.cwd(), depth = 3): Promise<string | undefined> => {
  for (const file of files) {
    try {
      const path = resolve(cwd, file)
      await access(path)
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return searchFile(files, dirname(cwd), depth - 1)
  }
  return undefined
}

export interface LoadOptions {
  /** Override `output.clean` from the user config. */
  clean?: boolean
  /** Override `strict` from the user config. */
  strict?: boolean
  /** Working directory for config discovery. @default process.cwd() */
  cwd?: string
}

export interface ConfigLoader {
  /** Load (or reload) the user config and return a resolved `Project`. */
  load<T extends Collections = Collections>(path: string | undefined, options?: LoadOptions): Promise<Project<T>>
}

export interface ConfigLoaderOptions {
  logger?: Logger
}

/** Default internal asset filename template. */
const DEFAULT_ASSET_NAME = '[name]-[hash:8].[ext]'

interface PreparedOutdir {
  outdir: string
  configHash: string
}

/**
 * Create a config loader that bundles the user config with esbuild and loads
 * the resulting module from a stable temporary location.
 *
 * The loader resolves `velite.config.*` walking up from cwd, bundles it with
 * `packages: 'external'` (user deps stay external), rewrites self-imports of
 * `velite` to the current package entry, writes the bundle to a stable temp
 * directory, and symlinks the project's `node_modules` so external imports
 * resolve. The temp dir is keyed by the config path so watch reloads replace
 * the previous bundle in place.
 */
export const createConfigLoader = ({ logger = defaultLogger }: ConfigLoaderOptions = {}): ConfigLoader => {
  const prepared = new Map<string, PreparedOutdir>()

  const prepareOutdir = async (configPath: string): Promise<string> => {
    const cached = prepared.get(configPath)
    if (cached != null) return cached.outdir

    const configHash = createHash('sha256').update(configPath).digest('hex').slice(0, 16)
    const outdir = join(tmpdir(), 'velite', `config-${configHash}`)
    await mkdir(outdir, { recursive: true })

    const modules = await searchFile(['node_modules'], dirname(configPath))
    if (modules != null) {
      const link = join(outdir, 'node_modules')
      try {
        await symlink(modules, link, 'dir')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        let current: string | undefined
        try {
          current = await readlink(link)
        } catch {
          current = undefined
        }
        if (current !== modules) {
          await rm(link, { recursive: true, force: true })
          await symlink(modules, link, 'dir')
        }
      }
    }

    prepared.set(configPath, { outdir, configHash })
    return outdir
  }

  const bundle = async <T extends Collections>(configPath: string): Promise<{ mod: UserConfig<T>; deps: string[] }> => {
    if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(configPath)) {
      const ext = configPath.split('.').pop()
      throw new Error(`not supported config file with '${ext}' extension`)
    }

    const outdir = await prepareOutdir(configPath)
    const outfile = join(outdir, 'config.mjs')

    const result = await esbuild({
      entryPoints: [configPath],
      outfile,
      bundle: true,
      write: true,
      format: 'esm',
      target: 'node22',
      platform: 'node',
      metafile: true,
      plugins: [
        {
          name: 'velite-self-reference',
          setup(build) {
            build.onResolve({ filter: new RegExp(`^${pkgName}$`) }, () => ({
              path: fileURLToPath(import.meta.resolve(pkgName)),
              external: true
            }))
          }
        }
      ],
      packages: 'external'
    })

    const deps = Object.keys(result.metafile.inputs).map(file => resolve(file))

    const configUrl = pathToFileURL(outfile)
    configUrl.searchParams.set('t', Date.now().toString())

    const mod = await import(configUrl.href)
    return { mod: (mod.default ?? mod) as UserConfig<T>, deps }
  }

  return {
    async load<T extends Collections = Collections>(path: string | undefined, options: LoadOptions = {}) {
      const searchCwd = options.cwd ?? process.cwd()
      const candidates = path != null ? [path] : CONFIG_NAMES
      const configPath = await searchFile(candidates, searchCwd)
      if (configPath == null) {
        throw new Error(`config file not found, create '${pkgName}.config.ts' in your project root`)
      }

      const { mod: loadedConfig, deps: configImports } = await bundle<T>(configPath)

      if (loadedConfig.collections == null) {
        throw new Error(`'collections' is required in '${configPath}'`)
      }
      validateCollections(loadedConfig.collections)

      logger.debug?.(`using config '${configPath}'`)

      const cwd = dirname(configPath)
      const output = loadedConfig.output

      return {
        root: resolve(cwd, loadedConfig.root ?? 'content'),
        configPath,
        configImports,
        collections: loadedConfig.collections,
        loaders: [...(loadedConfig.loaders ?? []), ...builtinLoaders],
        output: {
          data: resolve(cwd, output?.data ?? '.velite'),
          assets: resolve(cwd, output?.assets ?? 'public/static'),
          base: output?.base ?? '/static/',
          name: DEFAULT_ASSET_NAME,
          format: output?.format ?? 'esm',
          clean: options.clean ?? output?.clean ?? false
        },
        strict: options.strict ?? loadedConfig.strict ?? false,
        markdown: loadedConfig.markdown,
        mdx: loadedConfig.mdx,
        prepare: loadedConfig.prepare
      } as Project<T>
    }
  }
}
