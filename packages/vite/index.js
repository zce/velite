import { build } from 'velite'

/**
 * Velite Vite plugin
 * @param {Object} options - Options
 * @param {string} options.config - Path to velite.config.ts
 * @returns {import('vite').Plugin} Vite plugin
 */
export default (options = {}) => {
  let started = false

  return {
    name: '@velite/plugin-vite',

    configureServer: async () => {
      if (started) return
      started = true

      // Start watch mode in dev
      await build({ config: options.config, watch: true })
    },

    buildStart: async () => {
      if (started) return

      // Run build in production
      await build({ config: options.config, watch: false })
    }
  }
}
