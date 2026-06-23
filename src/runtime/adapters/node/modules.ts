import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../../../package.json'

import type { ModuleLoader } from '../../modules'

export interface JitiModuleLoaderDeps {
  packageName?: string
  baseUrl?: string
}

export const createJitiModuleLoader = ({ packageName = pkgName, baseUrl = import.meta.url }: JitiModuleLoaderDeps = {}): ModuleLoader => {
  const createLoader = (): ReturnType<typeof createJiti> =>
    createJiti(baseUrl, {
      interopDefault: true,
      alias: {
        [packageName]: fileURLToPath(import.meta.resolve(packageName))
      }
    })

  /**
   * Module loader adapter using jiti to import TS/JS modules at runtime (no
   * separate build step). A fresh jiti instance per load keeps config reloads
   * fresh; its per-load cache is still used to discover local files pulled in
   * during evaluation for watch-mode dependency tracking. `default: true`
   * returns the effective export value, matching Velite config loading.
   */
  return {
    async load(absPath) {
      const jiti = createLoader()
      const before = new Set(Object.keys(jiti.cache))
      const exports = await jiti.import(absPath, { default: true })
      const after = new Set(Object.keys(jiti.cache))
      const dependencies = [...after].filter(dep => !before.has(dep))
      return { exports, dependencies }
    }
  }
}

export const jitiModuleLoader: ModuleLoader = createJitiModuleLoader({})
