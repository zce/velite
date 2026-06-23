import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../../../package.json'

import type { ModuleLoader } from '../../modules'

export interface JitiModuleLoaderDeps {
  packageName?: string
  baseUrl?: string
}

export const createJitiModuleLoader = ({ packageName = pkgName, baseUrl = import.meta.url }: JitiModuleLoaderDeps = {}): ModuleLoader => {
  // Lazy jiti instance scoped to this module instance. Keeping the cache inside
  // the factory closure avoids hidden process-wide loader state.
  let jiti: ReturnType<typeof createJiti> | undefined

  const getJiti = (): ReturnType<typeof createJiti> => {
    if (jiti == null) {
      jiti = createJiti(baseUrl, {
        interopDefault: true,
        moduleCache: false,
        alias: {
          [packageName]: fileURLToPath(import.meta.resolve(packageName))
        }
      })
    }
    return jiti
  }

  /**
   * Module loader adapter using jiti to import TS/JS modules at runtime (no
   * separate build step). Returns the full module namespace so callers can pick
   * between `default` and named exports.
   */
  return {
    async load(absPath) {
      const exports = await getJiti().import(absPath)
      return { exports, dependencies: [] }
    }
  }
}

export const jitiModuleLoader: ModuleLoader = createJitiModuleLoader({})
