import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../package.json'

import type { ConfigLoader } from './core/host/config'

// Lazy jiti instance — created once and reused (moduleCache disabled so watch
// reloads pick up config edits). The `velite` import is aliased to this
// package's built entry so user configs can `import { ... } from 'velite'`.
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
 * Config loader adapter using jiti to import TS/JS config modules at runtime
 * (no separate build step). Returns the module's default export.
 */
export const jitiConfigLoader: ConfigLoader = {
  async load(absPath) {
    const config = await getJiti().import(absPath, { default: true })
    return { config, dependencies: [] }
  }
}
