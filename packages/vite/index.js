import { build, watch } from 'velite'

/**
 * Velite Vite plugin
 * @param {Omit<import('velite').Options, 'watch'>} options - Velite options
 * @returns {import('vite').Plugin} Vite plugin
 */
export default (options = {}) => {
  let started = false
  let watcher

  return {
    name: '@velite/plugin-vite',

    configureServer: async server => {
      if (started) return
      started = true

      // Start watch mode in dev
      watcher = await watch(options)
      server.httpServer?.once('close', () => {
        void watcher?.close()
        watcher = undefined
      })
    },

    buildStart: async () => {
      if (started) return

      // Run build in production
      await build({ ...options, watch: false })
    }
  }
}
