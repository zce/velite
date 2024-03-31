# Snippets

## Built-in `s.mdx()` schema result render

```tsx
import * as runtime from 'react/jsx-runtime'

const sharedComponents = {
  // Add your global components here
}

// parse the Velite generated MDX code into a React component function
const useMDXComponent = (code: string) => {
  const fn = new Function(code)
  return fn({ ...runtime }).default
}

interface MDXProps {
  code: string
  components?: Record<string, React.ComponentType>
}

// MDXContent component
export const MDXContent = ({ code, components }: MDXProps) => {
  const Component = useMDXComponent(code)
  return <Component components={{ ...sharedComponents, ...components }} />
}
```

## MDX Bundle with ESBuild

```tsx
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
    platform: 'neutral',
    format: 'esm',
    globalName: 'VELITE_MDX_COMPONENT',
    treeShaking: true,
    jsx: 'automatic',
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

## Next.js Integration

::: code-group

```js [CommonJS]
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
  constructor(/** @type {import('velite').Options} */ options = {}) {
    this.options = options
  }
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs !!!
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
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

```js [ESM]
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
  constructor(/** @type {import('velite').Options} */ options = {}) {
    this.options = options
  }
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs !!!
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      this.options.watch = this.options.watch ?? dev
      this.options.clean = this.options.clean ?? !dev
      await build(this.options) // start velite
    })
  }
}
```

:::

## HTML Excerpt

```ts
import { excerpt as hastExcerpt } from 'hast-util-excerpt'
import { raw } from 'hast-util-raw'
import { toHtml } from 'hast-util-to-html'
import { truncate } from 'hast-util-truncate'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

import { extractHastLinkedFiles } from '../assets'
import { custom } from './zod'

export interface ExcerptOptions {
  /**
   * Excerpt separator.
   * @default 'more'
   * @example
   * s.excerpt({ separator: 'preview' }) // split excerpt by `<!-- preview -->`
   */
  separator?: string
  /**
   * Excerpt length.
   * @default 300
   */
  length?: number
}

export const excerpt = ({ separator = 'more', length = 300 }: ExcerptOptions = {}) =>
  custom<string>().transform(async (value, { meta: { path, content, config } }) => {
    if (value == null && content != null) {
      value = content
    }
    try {
      const mdast = fromMarkdown(value)
      const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
      const exHast = hastExcerpt(hast, { comment: separator, maxSearchSize: 1024 })
      const output = exHast ?? truncate(hast, { size: length, ellipsis: '…' })
      await rehypeCopyLinkedFiles(config.output)(output, { path })
      return toHtml(output)
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
```
