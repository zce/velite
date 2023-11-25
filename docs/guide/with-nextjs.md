# Integration with Next.js

The Next.js plugin is still under development...

- [examples/nextjs](https://github.com/zce/velite/tree/main/examples/nextjs)

## Start Velite with Next.js Plugin

in your `next.config.js`:

```js
/** @type {import('next').NextConfig} */
module.exports = {
  // othor next config here...
  webpack: config => {
    config.plugins.push(new VeliteWebpackPlugin())
    return config
  }
}

class VeliteWebpackPlugin {
  static started = false
  constructor(/** @type {import('velite').BuildOptions} */ options = {}) {
    this.options = options
  }
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tap('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      this.options.watch = this.options.watch ?? dev
      this.options.clean = this.options.clean ?? !dev
      const { build } = await import('velite')
      await build(this.options)
    })
  }
}
```

## Typed Routes

```ts
link: z.string() as Route<'/posts/${string}'>
```
