/**
 * next plugin for velite
 * @param {import('next').NextConfig} nextConfig
 * @returns
 */
exports.withVelite = nextConfig => {
  nextConfig.plugins.push(new VeliteWebpackPlugin())
  return {
    ...nextConfig,
    // othor next config here...
    webpack: (config, options) => {
      config = nextConfig?.webpack?.(config, options) ?? config
      config.plugins.push(new VeliteWebpackPlugin())
      return config
    }
  }
}

class VeliteWebpackPlugin {
  static started = false
  apply(compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tap('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      const { build } = await import('velite')
      await build({ watch: dev, clean: !dev })
    })
  }
}
