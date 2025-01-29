# Introduction

::: warning

🚧 This documentation is not yet complete currently. but the functionality is mostly stable, although there is still a possibility of significant changes being made.

However, I have provided some [examples](https://github.com/zce/velite/tree/main/examples) for your consideration.

:::

## What is Velite?

Velite is a tool for building type-safe data layer, turns Markdown / MDX, YAML, JSON, or other files into app's data layer with Zod schema.

![Velite Workflow](/assets/flow-dark.svg#dark 'Velite Workflow')
![Velite Workflow](/assets/flow.svg#light 'Velite Workflow')

### Naming Origin

"Velite" comes from the English word "elite".

> "Velite" itself is the code name for Napoleon's elite army.

## Key Features

- **Easy to use**: Move your contents into `content` folder, define collections schema, run `velite`, then use the output data in your application.
- **Type-safe**: Contents schema validation by [Zod](https://zod.dev), and generate type definitions for TypeScript.
- **Framework Agnostic**: JSON & Entry & DTS output, out of the box support for any JavaScript framework or library.
- **Light-weight**: Choose more native APIs instead of bloated NPM modules, less runtime dependencies, so it is fast and efficiently.
- **Still powerful**: Built-in Markdown / MDX, YAML, JSON support, relative files & images processing, schema validation, etc.
- **Configurable**: Both input and output directories can be customized, and support for custom loaders, hooks, etc.
- **Extensible**: Support any file types by custom loaders, Custom field validation and transform by custom schema, and any output formats by hooks.

Check out our detailed [Why Velite](#why-velite) to learn more about what makes Velite special. ✨

## Try Velite Online

You can try Velite directly in your browser on StackBlitz, It runs Velite directly in the browser, and it is almost identical to the local setup but doesn't require installing anything on your machine.

- https://stackblitz.com/edit/velite-basic
- https://stackblitz.com/edit/velite-nextjs

## Who's using Velite?

- [Ark UI](https://github.com/chakra-ui/ark)
- [Chakra UI](https://github.com/chakra-ui/chakra-ui)
- [Park UI](https://github.com/cschroeter/park-ui)
- [etc.](https://github.com/zce/velite/network/dependents)

## Why Velite?

### Type-Safe Contents

Velite validates your contents by [Zod](https://zod.dev) schema, and generates type definitions for TypeScript. so you can use the output data in your application with confidence.

### Full Type inference

<p><video src="/assets/type-inference@2x.mp4" loop muted autoplay /></p>

- auto-generate TypeScript type definitions for each collection
- support IDE IntelliSense, auto-completion & type checking & refactoring & etc.

### Full Controllable Content Transform

- single field transform:
  ```ts
  title: s.string().transform(value => value.toUpperCase())
  ```
- single collection transform:
  ```ts
  schema: s.object({
    title: s.string(),
    slug: s.string()
  }).transform(value => ({
    ...value,
    url: `/blog/${value.slug}`
  }))
  ```
- all collections transform:
  ```ts
  defineConfig({
    prepare: async ({ posts, tags }) => {
      posts.push({
        title: 'Hello World',
        slug: 'hello-world',
        tags: ['hello', 'world']
      })
      tags.push({
        name: 'Hello',
        slug: 'hello'
      })
    }
  })
  ```

### Error Reporting Friendly

![Error Reporting Friendly](/assets/error-reporting-friendly.jpg)

- error reporting friendly, show error message with file path & property path

### Framework Agnostic

Velite is framework agnostic, and out of the box support for React, Vue, Svelte, Solid, etc.

### Less Runtime Dependencies

- user config bundle by [ESBuild](https://esbuild.github.io)
- collection schema validation by [Zod](https://zod.dev)
- content transform by [Unified](https://unifiedjs.com)
- image processing by [Sharp](https://sharp.pixelplumbing.com)
- file watching by [Chokidar](https://github.com/paulmillr/chokidar)

### Fast Rebuild

More then **1000** documents with **2000** assets, less then **8s** for cold start, less then **60ms** for hot rebuild.

Refers to [Velite Benchmark](https://github.com/zce/velite-benchmark) for more information.

## Why not Contentlayer?

[Contentlayer](https://contentlayer.dev) is a great tool, but it is [unmaintained](https://github.com/contentlayerdev/contentlayer/issues/429) and not suitable for my needs. Such as:

- built-in files & images processing
- programmability & extensibility
- custom collection schema validation
- error reporting friendly
- etc.

> Velite is inspired by [Contentlayer](https://contentlayer.dev).
