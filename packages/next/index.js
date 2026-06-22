/**
 * Thanks to `https://github.com/sdorra/content-collections` for Next.js v16+ Velite integration.
 */

/**
 * Create a Next.js plugin for integrating Velite
 * @param {import('velite').BuildEntryOptions} pluginOptions
 * @returns {import('next').NextConfig} Next.js plugin
 */
export const createNextPlugin = (pluginOptions = {}) => {
  const [command] = process.argv.slice(2).filter(i => !i.startsWith('-'))

  // typegen loads next.config.js
  const isTypegen = command === 'typegen'

  // the build step loads next.config.js
  const isBuild = command === 'build'

  // starting with v16 next dev doesn't load next.config.js
  // next dev - calls next-start in a forked process
  // next-start loads next.config.js
  // process.argv are not visible by next-start
  const isDev =
    // to make this compatible with previous versions
    // check if command is NOT set (next-start) and we are in development mode
    typeof command === 'undefined' && process.env.NODE_ENV === 'development'

  /**
   * @param {import('next').NextConfig} nextConfig
   * @returns {Promise<import('next').NextConfig>}
   */
  return async (nextConfig = {}) => {
    // prevent multiple calls
    if (process.env.__VELITE_STARTED) return nextConfig

    // if not dev, build, or typegen, return the next config
    if (!isDev && !isBuild && !isTypegen) return nextConfig

    // start velite
    process.env.__VELITE_STARTED = '1'

    const velite = await import('velite')

    if (isDev) {
      // dev: run an initial build, then keep watching for changes
      await velite.watch({ ...pluginOptions, clean: false })
    } else {
      // build / typegen: one-shot production build
      await velite.build({ ...pluginOptions, clean: true })
    }

    return nextConfig
  }
}

export const withVelite = createNextPlugin()
