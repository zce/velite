import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../../../package.json'

import type { ModuleLoader } from '../../modules'

// Lazy jiti instance — created once and reused (moduleCache disabled so watch
// reloads pick up edits). The `velite` import is aliased to this package's
// built entry so user configs can `import { ... } from 'velite'`.
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
 * Module loader adapter using jiti to import TS/JS modules at runtime (no
 * separate build step). Returns the full module namespace so callers can pick
 * between `default` and named exports.
 */
export const jitiModuleLoader: ModuleLoader = {
  async load(absPath) {
    const exports = await getJiti().import(absPath)
    return { exports, dependencies: [] }
  }
}
