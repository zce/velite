# MDX Support

Velite supports MDX out of the box. You can use MDX to write your content, and Velite will automatically render it for you.

> [!TIP] Some examples that may help you:
>
> - [examples/nextjs](https://github.com/zce/velite/tree/main/examples/nextjs) - A Next.js and MDX example.
> - [zce/taxonomy](https://github.com/zce/taxonomy) - A fork of [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) using Velite.

## Getting Started

For example, suppose you have the following content structure:

```diff {2,3,4}
project-root
├── content
│   └── posts
│       └── hello-world.mdx
├── public
├── package.json
└── velite.config.js
```

The`./content/posts/hello-world.mdx` document is a MDX document with the following content:

```mdx
---
title: Hello world
---

export const year = 2023

# Last year’s snowfall

In {year}, the snowfall was above average.
It was followed by a warm spring which caused
flood conditions in many of the nearby rivers.

<Chart year={year} color="#fcb32c" />
```

Use the `s.mdx()` schema to add the compiled MDX code to your content collection.

```js {10}
import { defineConfig, s } from 'velite'

export default defineConfig({
  collections: {
    posts: {
      name: 'Post',
      pattern: 'posts/*.mdx',
      schema: s.object({
        title: s.string(),
        code: s.mdx()
      })
    }
  }
})
```

Run `velite build` and you will get the following data structure:

```json
{
  "posts": [
    {
      "title": "Hello world",
      "code": "const{Fragment:n,jsx:e,jsxs:t}=arguments[0],o=2023;function _createMdxContent(r){const a={h1:\"h1\",p:\"p\",...r.components},{Chart:c}=a;return c||function(n,e){throw new Error(\"Expected \"+(e?\"component\":\"object\")+\" `\"+n+\"` to be defined: you likely forgot to import, pass, or provide it.\")}(\"Chart\",!0),t(n,{children:[e(a.h1,{children:\"Last year’s snowfall\"}),\"\\n\",t(a.p,{children:[\"In \",o,\", the snowfall was above average.\\nIt was followed by a warm spring which caused\\nflood conditions in many of the nearby rivers.\"]}),\"\\n\",e(c,{year:o,color:\"#fcb32c\"})]})}return{year:o,default:function(n={}){const{wrapper:t}=n.components||{};return t?e(t,{...n,children:e(_createMdxContent,{...n})}):_createMdxContent(n)}};"
    }
  ]
}
```

By default, Velite will compile the MDX content into a function-body string, which can be used to render the content in your application.

## Rendering MDX Content

First, you can create a generic component for rendering the compiled mdx code. It should accept the code and a list of components that are used in the MDX content.

`./components/mdx-content.tsx`:

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

Then, you can use the `MDXContent` component to render the MDX content:

`./pages/posts/[slug].tsx`:

```tsx
import { posts } from '@/.velite'
import { Chart } from '@/components/chart' // import your custom components
import { MDXContent } from '@/components/mdx-content'

export default function Post({ params: { slug } }) {
  const post = posts.find(i => i.slug === slug)
  return (
    <article>
      <h1>{post.title}</h1>
      <MDXContent code={post.code} components={{ Chart }} />
    </article>
  )
}
```

## FAQ

### How to import components in MDX?

You don't need to, since Velite's `s.mdx()` schema does not bundle those components at build time. There is no need to construct a import tree. This can help reduce output size for your contents.

For example, suppose you extract a common component for multiple MDXs and import the component in these MDXs.

::: code-group

```tsx [./components/callout.tsx]
export const Callout = ({ children }: { children: React.ReactNode }) => {
  // your common component
  return <div style={{ border: '1px solid #ddd', padding: '1rem' }}>{children}</div>
}
```

```mdx [./posts/foo.mdx]
---
title: Foo
---

import { Callout } from '../components/callout'

# Foo

<Callout>This is foo callout.</Callout>
```

```mdx [./posts/bar.mdx]
---
title: Bar
---

import { Callout } from '../components/callout'

# Bar

<Callout>This is bar callout.</Callout>
```

:::

If Velite uses a bundler to compile your MDX, the `Callout` component will be bundled into each MDX file, which will cause a lot of redundancy in the output code.

Instead, simply use whatever components you want in your MDX files without a import.

::: code-group

```mdx [./posts/foo.mdx]
---
title: Foo
---

# Foo

<Callout>This is foo callout.</Callout>
```

```mdx [./posts/bar.mdx]
---
title: Bar
---

# Bar

<Callout>This is bar callout.</Callout>
```

:::

Then, inject the components into the `MDXContent` component:

```tsx {1,9}
import { Callout } from '@/components/callout'
import { MDXContent } from '@/components/mdx-content'

export default function Post({ params: { slug } }) {
  const post = posts.find(i => i.slug === slug)
  return (
    <article>
      <h1>{post.title}</h1>
      <MDXContent code={post.code} components={{ Callout }} />
    </article>
  )
}
```

You can also add global components so that they are available to all MDX files.

```tsx {3,7}
import * as runtime from 'react/jsx-runtime'

import { Callout } from '@/components/callout'

const sharedComponents = {
  // Add your global components here
  Callout
}

const useMDXComponent = (code: string) => {
  const fn = new Function(code)
  return fn({ ...runtime }).default
}

interface MDXProps {
  code: string
  components?: Record<string, React.ComponentType>
}

export const MDXContent = ({ code, components }: MDXProps) => {
  const Component = useMDXComponent(code)
  return <Component components={{ ...sharedComponents, ...components }} />
}
```

### What if I want to bundle MDX?

If you can make do with the increased output size, bundling MDX can be a good option for better portability.

You can install the following packages to bundle MDX:

```bash
npm i esbuild @fal-works/esbuild-plugin-global-externals @mdx-js/esbuild --save-dev
```

Then, create a custom schema for MDX bundling:

> [!CAUTION]
> The following code is just a simple example. You may need to adjust it according to your actual situation.

```ts
import { dirname, join } from 'node:path'
import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'

import type { Plugin } from 'esbuild'

const compileMdx = async (source: string, path: string, options: CompileOptions): Promise<string> => {
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
    absWorkingDir: dirname(path),
    write: false,
    bundle: true,
    target: 'node18',
    platform: 'neutral',
    format: 'esm',
    globalName: 'VELITE_MDX_COMPONENT',
    treeShaking: true,
    jsx: 'automatic',
    minify: true,
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

export const mdxBundle = (options: MdxOptions = {}) =>
  custom<string>().transform<string>(async (value, { meta: { path, content, config }, addIssue }) => {
    value = value ?? content
    if (value == null) {
      addIssue({ fatal: true, code: 'custom', message: 'The content is empty' })
      return null as never
    }

    const enableGfm = options.gfm ?? config.mdx?.gfm ?? true
    const enableMinify = options.minify ?? config.mdx?.minify ?? true
    const removeComments = options.removeComments ?? config.mdx?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? config.mdx?.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? config.mdx?.outputFormat ?? 'function-body'

    const remarkPlugins = [] as PluggableList
    const rehypePlugins = [] as PluggableList

    if (enableGfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, config.output]) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins
    if (config.mdx?.remarkPlugins != null) remarkPlugins.push(...config.mdx.remarkPlugins) // apply global remark plugins
    if (config.mdx?.rehypePlugins != null) rehypePlugins.push(...config.mdx.rehypePlugins) // apply global rehype plugins

    const compilerOptions = { ...config.mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

    try {
      return await compileMdx(value, path, compilerOptions)
    } catch (err: any) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null as never
    }
  })
```

Then, you can use the custom schema in your `velite.config.js`:

```js {10}
import { defineConfig, s } from 'velite'

import { mdxBundle } from './mdx'

export default defineConfig({
  collections: {
    posts: {
      name: 'Post',
      pattern: 'posts/*.mdx',
      schema: s.object({
        title: s.string(),
        code: mdxBundle()
      })
    }
  }
})
```
