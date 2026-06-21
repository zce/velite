import { createJiti } from 'jiti'

import type { ConfigLoader } from './core/host/config'

/**
 * Config loader adapter using jiti to import TS/JS config modules at runtime
 * (no separate build step). Returns the module's default export.
 */
export const jitiConfigLoader: ConfigLoader = {
  async load(absPath) {
    const jiti = createJiti(import.meta.url)
    const config = await jiti.import(absPath, { default: true })
    return { config, dependencies: [] }
  }
}
