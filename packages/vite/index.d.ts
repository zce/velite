import type { Options as VeliteOptions } from 'velite'
import type { Plugin } from 'vite'

type Options = Omit<VeliteOptions, 'watch'>

/**
 * Velite Vite plugin
 * @param {Options} options - Options
 * @returns {Plugin} Vite plugin
 */
declare function velitePlugin(options?: Options): Plugin

export { velitePlugin as default, type Options }
