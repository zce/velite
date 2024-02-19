# Next.js + MDX + Velite

A template with Next.js 13 app dir, [Velite](https://github.com/zce/velite), Tailwind CSS and dark mode.

[MDX Example](content/pages/contact/index.mdx)

## Recipes

#### start Velite in npm script with `npm-run-all`:

**package.json**:

```json
{
  "scripts": {
    "dev:content": "velite --watch",
    "build:content": "velite --clean",
    "dev:next": "next dev",
    "build:next": "next build",
    "dev": "run-p dev:*",
    "build": "run-s build:*",
    "start": "next start"
  }
}
```

#### start Velite with `next dev` and `next build` commands.

**next.config.js**:

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
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      const { build } = await import('velite')
      await build({ watch: dev, clean: !dev })
    })
  }
}
```

or ESM version (package.json with `"type": "module"`):

```js
import { build } from 'velite'

/** @type {import('next').NextConfig} */
export default {
  // othor next config here...
  webpack: config => {
    config.plugins.push(new VeliteWebpackPlugin())
    return config
  }
}

class VeliteWebpackPlugin {
  static started = false
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      await build({ watch: dev, clean: !dev })
    })
  }
}
```

#### MDX Bundle

```typescript
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'

import type { Plugin } from 'esbuild'

const compileMdx = async (source: string): Promise<string> => {
  const virtualSourse: Plugin = {
    name: 'virtual-source',
    setup: build => {
      build.onResolve({ filter: /^__faker_entry/ }, args => {
        return {
          path: join(args.resolveDir, args.path),
          pluginData: { contents: source } // for mdxPlugin
        }
      })
    }
  }

  const bundled = await build({
    entryPoints: [`__faker_entry.mdx`],
    absWorkingDir: resolve('content'),
    write: false,
    bundle: true,
    target: 'node18',
    format: 'esm',
    globalName: 'VELITE_MDX_COMPONENT',
    treeShaking: true,
    // minify: true,
    plugins: [
      virtualSourse,
      mdxPlugin({}),
      globalExternals({
        react: {
          varName: 'React',
          type: 'cjs'
        },
        'react-dom': {
          varName: 'ReactDOM',
          type: 'cjs'
        },
        'react/jsx-runtime': {
          varName: '_jsx_runtime',
          type: 'cjs'
        }
      })
    ]
  })

  return bundled.outputFiles[0].text.replace('var VELITE_MDX_COMPONENT=', 'return ')
}
```
