// @ts-check

module.exports =
  (/** @type {import('.').BuildOptions} */ pluginOptions) =>
  (/** @type {import('next').NextConfig} */ nextConfig = {}) => {
    return {
      ...nextConfig,
      webpack(config, options) {
        config.plugins.push(new VeliteWebpackPlugin(pluginOptions))
        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, options)
        }
        return config
      }
    }
  }

class VeliteWebpackPlugin {
  static started = false
  constructor(/** @type {import('.').BuildOptions} */ options = {}) {
    this.options = options
  }
  apply(compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tap('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      this.options.watch = this.options.watch ?? dev
      this.options.clean = this.options.clean ?? !dev
      const { build } = await import('.')
      await build(this.options)
    })
  }
}
