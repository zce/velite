# Snippets

## Last Modified Schema

### Based on file stat

```ts
import { stat } from 'fs/promises'
import { context, s } from 'velite'

const timestamp = () =>
  s
    .string()
    .optional()
    .transform<string>(async () => {
      const { file } = context()
      const stats = await stat(file.path)
      return stats.mtime.toISOString()
    })

// use it in your schema
const posts = defineCollection({
  // ...
  schema: {
    // ...
    lastModified: timestamp()
  }
})
```

### Based on git timestamp

```ts
import { exec } from 'child_process'
import { promisify } from 'util'
import { context, s } from 'velite'

const execAsync = promisify(exec)

const timestamp = () =>
  s
    .string()
    .optional()
    .transform<string>(async () => {
      const { file } = context()
      const { stdout } = await execAsync(`git log -1 --format=%cd ${file.path}`)
      return new Date(stdout || Date.now()).toISOString()
    })

// use it in your schema
const posts = defineCollection({
  // ...
  schema: {
    // ...
    lastModified: timestamp()
  }
})
```

## Remote Image with BlurDataURL Schema

```ts
import { context, s } from 'velite'

import type { ImageData } from 'velite'

/**
 * Remote Image with metadata schema
 */
export const remoteImage = () =>
  s.string().transform<ImageData>(async (value, ctx) => {
    try {
      const response = await fetch(value)
      const blob = await response.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const metadata = await context().probeImage(bytes)
      if (metadata.width === 0 || metadata.height === 0) throw new Error(`Failed to get image metadata: ${value}`)
      const { width, height, blurDataURL, blurWidth, blurHeight } = metadata
      return { src: value, width, height, blurDataURL, blurWidth, blurHeight }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
```

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
    target: 'node22',
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

> The maintained `@velite/plugin-next` package already wraps the pattern below. Reach for this snippet only if you need a fully inlined webpack plugin.

::: code-group

```js [CommonJS]
/** @type {import('next').NextConfig} */
module.exports = {
  // other next config here...
  webpack: config => {
    config.plugins.push(new VeliteWebpackPlugin())
    return config
  }
}

class VeliteWebpackPlugin {
  static started = false
  constructor(/** @type {import('velite').BuildEntryOptions} */ options = {}) {
    this.options = options
  }
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs !!!
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      const options = { clean: !dev, ...this.options }
      const velite = await import('velite')
      // dev: keep a watcher running so files rebuild on change.
      // prod: do a one-shot build and resolve.
      if (dev) {
        await velite.watch(options)
      } else {
        await velite.build(options)
      }
    })
  }
}
```

```js [ESM]
import { build, watch } from 'velite'

/** @type {import('next').NextConfig} */
export default {
  // other next config here...
  webpack: config => {
    config.plugins.push(new VeliteWebpackPlugin())
    return config
  }
}

class VeliteWebpackPlugin {
  static started = false
  constructor(/** @type {import('velite').BuildEntryOptions} */ options = {}) {
    this.options = options
  }
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs !!!
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      const options = { clean: !dev, ...this.options }
      // dev: keep a watcher running so files rebuild on change.
      // prod: do a one-shot build and resolve.
      if (dev) {
        await watch(options)
      } else {
        await build(options)
      }
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
import { context, s } from 'velite'

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
  s.custom<string>().transform(async (value, ctx) => {
    const { file } = context()
    if (value == null && file.content != null) {
      value = file.content
    }
    try {
      const mdast = fromMarkdown(value)
      const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
      const exHast = hastExcerpt(hast, { comment: separator, maxSearchSize: 1024 })
      const output = exHast ?? truncate(hast, { size: length, ellipsis: '…' })
      return toHtml(output)
    } catch (err: any) {
      ctx.addIssue({ fatal: true, code: 'custom', message: err.message })
      return value
    }
  })
```
