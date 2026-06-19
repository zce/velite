import { createHash } from 'node:crypto'
import { access, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as esbuild } from 'esbuild'

import { name as pkgName } from '../../package.json'
import { loaders as builtinLoaders } from '../loaders'
import { logger as defaultLogger } from '../runtime/logger'

import type { Collections } from '../collections'
import type { Logger } from '../runtime/logger'
import type { ResolvedConfig, UserConfig } from './index'

const CONFIG_NAMES = [
  pkgName + '.config.js',
  pkgName + '.config.ts',
  pkgName + '.config.mjs',
  pkgName + '.config.mts',
  pkgName + '.config.cjs',
  pkgName + '.config.cts'
] as const

const TYPE_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/
const RESERVED_TYPE_NAMES = new Set([
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

const validateCollectionNames = (collections: Collections): void => {
  Object.entries(collections).forEach(([key, collection]) => {
    if (!TYPE_IDENTIFIER_RE.test(collection.name) || RESERVED_TYPE_NAMES.has(collection.name)) {
      throw new Error(`collection '${key}' name '${collection.name}' must be a valid TypeScript identifier`)
    }
  })
}

/**
 * Recursively search up to `depth` parent directories for the first matching file.
 */
const searchFiles = async (files: readonly string[], cwd: string = process.cwd(), depth: number = 3): Promise<string | undefined> => {
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
    return await searchFiles(files, dirname(cwd), depth - 1)
  }
  return undefined
}

export interface LoadOptions {
  /** Override `output.clean` from the user config. */
  clean?: boolean
  /** Override `strict` from the user config. */
  strict?: boolean
}

export interface ConfigLoader {
  /**
   * Load (or reload) the user config and return a fully resolved `ResolvedConfig`.
   *
   * The same loader instance reuses its temporary bundle directory across
   * watch reloads instead of accumulating bundle files.
   */
  load<T extends Collections = Collections>(path: string | undefined, options?: LoadOptions): Promise<ResolvedConfig<T>>
}

export interface ConfigLoaderOptions {
  logger?: Logger
}

interface PreparedOutdir {
  outdir: string
  configHash: string
}

/**
 * Create a config loader that bundles the user config with esbuild and loads
 * the resulting module from a stable temporary location.
 *
 * The loader:
 *   - resolves the user `velite.config.*` file walking up from cwd,
 *   - bundles it with `packages: 'external'` so user deps stay external,
 *   - rewrites self-imports of `velite` to the current package entry,
 *   - writes the bundle to `tmpdir()/velite/config-<hash>/config.mjs`,
 *   - symlinks the user project's `node_modules` into the temp directory so
 *     external imports resolve.
 *
 * The hash is derived from the absolute config path so each project gets its
 * own stable temp directory and watch reloads replace the previous bundle in
 * place.
 */
export const createConfigLoader = ({ logger = defaultLogger }: ConfigLoaderOptions = {}): ConfigLoader => {
  const prepared = new Map<string, PreparedOutdir>()

  const prepareOutdir = async (configPath: string): Promise<string> => {
    const cached = prepared.get(configPath)
    if (cached != null) return cached.outdir

    const configHash = createHash('sha256').update(configPath).digest('hex').slice(0, 16)
    const outdir = join(tmpdir(), 'velite', `config-${configHash}`)
    await mkdir(outdir, { recursive: true })

    const modules = await searchFiles(['node_modules'], dirname(configPath))
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
    return { mod: mod.default ?? mod, deps }
  }

  return {
    async load<T extends Collections = Collections>(path: string | undefined, options: LoadOptions = {}) {
      const begin = performance.now()

      const candidates = path != null ? [path] : CONFIG_NAMES
      const configPath = await searchFiles(candidates)
      if (configPath == null) {
        throw new Error(`config file not found, create '${pkgName}.config.ts' in your project root`)
      }

      const { mod: loadedConfig, deps: configImports } = await bundle<T>(configPath)

      if (loadedConfig.collections == null) {
        throw new Error(`'collections' is required in '${configPath}'`)
      }
      validateCollectionNames(loadedConfig.collections)

      logger.log(`using config '${configPath}'`, begin)

      const cwd = dirname(configPath)

      return {
        ...loadedConfig,
        configPath,
        configImports,
        root: resolve(cwd, loadedConfig.root ?? 'content'),
        output: {
          data: resolve(cwd, loadedConfig.output?.data ?? '.velite'),
          assets: resolve(cwd, loadedConfig.output?.assets ?? 'public/static'),
          base: loadedConfig.output?.base ?? '/static/',
          name: loadedConfig.output?.name ?? '[name]-[hash:8].[ext]',
          clean: options.clean ?? loadedConfig.output?.clean ?? false,
          format: loadedConfig.output?.format ?? 'esm'
        },
        loaders: [...(loadedConfig.loaders ?? []), ...builtinLoaders],
        strict: options.strict ?? loadedConfig.strict ?? false
      }
    }
  }
}
