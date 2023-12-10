# Integration with Next.js

Velite is a framework agnostic library, it can be used in any JavaScript framework or library, including Next.js.

Here is some recipes for help you better integrate Velite with Next.js.

## Start Velite with Next.js Plugin

You can use the Next.js plugin to call Velite's programmatic API to start Velite with better integration.

in your `next.config.js`:

```js
/** @type {import('next').NextConfig} */
module.exports = {
  // othor next config here...
  webpack: config => {
    // ignore nextjs watch content directory
    config.watchOptions.ignored = /content/
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
    // executed three times in nextjs !!!
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tap('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      this.options.watch = this.options.watch ?? dev
      this.options.clean = this.options.clean ?? !dev
      const { build } = await import('velite')
      await build(this.options) // start velite
    })
  }
}
```

::: tip

The Next.js plugin is still under development...

:::

## Typed Routes

When you use the `typedRoutes` experimental feature, you can get the typed routes in your Next.js app.

In this case, you can specify a more specific type for the relevant schema to make it easier to use on `next/link` or `next/router`.

e.g.

```ts
const options = defineCollection({
  // ...
  schema: s.object({
    // ...
    link: z.string() as Route<'/posts/${string}'>
  })
})
```

Then you can use it like this:

```tsx
import Link from 'next/link'

const Post = async () => {
  const options = await getOptions()
  return (
    <div>
      {/* typed route */}
      <Link href={options.link}>Read more</Link>
    </div>
  )
}
```

## Example

- [examples/nextjs](https://github.com/zce/velite/tree/main/examples/nextjs)
