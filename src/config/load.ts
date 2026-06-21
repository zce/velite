import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../package.json'

/**
 * Result of loading a config file.
 *
 * `path` is the absolute config file path. `dependencies` lists all files that
 * contributed to the config (currently just the config file itself; the old
 * esbuild-based loader tracked internal imports via metafile, but jiti loads
 * directly so only the entry is tracked). `config` is the loaded user config
 * object.
 */
export interface LoadedConfig<T = unknown> {
  readonly path: string
  readonly dependencies: readonly string[]
  readonly config: T
}

// Lazy jiti instance — created once and reused (moduleCache disabled so
// watch reloads pick up config edits).
let jiti: ReturnType<typeof createJiti> | undefined

const getJiti = (): ReturnType<typeof createJiti> => {
  if (jiti == null) {
    jiti = createJiti(import.meta.url, {
      interopDefault: true,
      moduleCache: false,
      alias: {
        [pkgName]: fileURLToPath(import.meta.resolve(pkgName))
      }
    })
  }
  return jiti
}

/**
 * Load a config file and return its default export.
 *
 * Uses jiti for TypeScript/ESM/CJS transparent loading. The `velite` import
 * is aliased to the current package entry so user configs can `import { ... } from 'velite'`.
 */
export const loadConfig = async <T = unknown>(configPath: string): Promise<LoadedConfig<T>> => {
  const jiti = getJiti()
  const config = await jiti.import<T>(configPath, { default: true })
  return { path: configPath, dependencies: [configPath], config }
}
