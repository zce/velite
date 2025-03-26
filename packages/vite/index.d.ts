import type { Plugin } from 'vite'

type Options = {
  /**
   * Path to velite.config.ts
   * @default 'velite.config.{js,ts}'
   */
  config?: string
}

/**
 * Velite Vite plugin
 * @param {Options} options - Options
 * @returns {Plugin} Vite plugin
 */
declare function velitePlugin(options?: Options): Plugin

export { velitePlugin as default, type Options }
