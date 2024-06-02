const isDev = process.argv.indexOf('dev') !== -1
const isBuild = process.argv.indexOf('build') !== -1
if (!process.env.VELITE_STARTED && (isDev || isBuild)) {
  process.env.VELITE_STARTED = '1'
  const { build } = await import('velite')
  await build({ watch: isDev, clean: !isDev })
}

/** @type {import('next').NextConfig} */
export default {}

// legacy next.config.js ↓ (not support turbopack)

// /** @type {import('next').NextConfig} */
// module.exports = {
//   // othor next config here...
//   webpack: config => {
//     config.plugins.push(new VeliteWebpackPlugin())
//     return config
//   }
// }

// class VeliteWebpackPlugin {
//   static started = false
//   apply(/** @type {import('webpack').Compiler} */ compiler) {
//     // executed three times in nextjs
//     // twice for the server (nodejs / edge runtime) and once for the client
//     compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
//       if (VeliteWebpackPlugin.started) return
//       VeliteWebpackPlugin.started = true
//       const dev = compiler.options.mode === 'development'
//       const { build } = await import('velite')
//       await build({ watch: dev, clean: !dev })
//     })
//   }
// }
