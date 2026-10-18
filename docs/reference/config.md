---
outline: deep
---

# Configuration

When running `velite` from the command line, Velite automatically resolves a config file named `velite.config.ts` (falling back to `.js`, `.mjs`, `.mts`, `.cjs`, `.cts` in that order) starting in the working directory and up to 3 parent directories.

## Velite Config File

Velite uses `velite.config.js` as the config file. You can create it in the root directory of your project.

```js
// velite.config.js
export default {
  // ...
}
```

::: tip

Config file supports TypeScript & ESM & CommonJS. you can use the full power of TypeScript to write your config file, and it's recommended strongly.

:::

## Typed Config

For better typing, Velite provides a `defineConfig` identity function to define the config file type.

```js
import { defineConfig } from 'velite'

export default defineConfig({
  // ...
})
```

In addition, Velite also provides a `UserConfig` type to describe the config file type. Schema contexts receive a `ProjectInfo` view of the resolved project; the full internal resolved project is not part of the public API.

```js
/** @type {import('velite').UserConfig} */
export default {
  // ...
}
```

```ts
import type { UserConfig } from 'velite'

const config: UserConfig = {
  // ...
}

export default config
```

::: tip

Recommended to use `defineConfig` identity function to define the config file type, because it can provide better type inference.

:::

And other identity functions to help you define the config file type:

- `defineCollection`: define collection options
- `defineLoader`: define a file loader

## `root`

- Type: `string`
- Default: `'content'`

The root directory of the contents, relative to the working directory where Velite runs (not the config file — the config may be discovered in a parent directory).

## `output`

- Type: `object`

The output configuration.

### `output.data`

- Type: `string`
- Default: `'.velite'`

The output directory of the data files, relative to the working directory.

### `output.assets`

- Type: `string`
- Default: `'public/static'`

The directory of the assets, relative to the working directory. This directory should be served statically by the app.

### `output.base`

- Type: `string`
- Default: `'/static/'`

The public base path of the assets. This option is used to generate the asset URLs. It should be the same as the `base` option of the app and end with a slash.

### `output.name`

- Type: `string`
- Default: `'[name]-[hash:8].[ext]'`

The filename template for emitted assets. Supports `[name]`, `[hash]`, `[hash:N]`, and `[ext]` placeholders, and the `/` character to nest assets under sub-directories of the assets directory.

### `output.format`

- Type: `'esm' | 'cjs'`
- Default: `'esm'`

The output format of the entry file.

## `collections`

- Type: `{ [name: string]: Collection }`

The collections definition.

### `collections[key].typeName`

- Type: `string`

The generated TypeScript type name for the collection.

```js
const posts = defineCollection({
  typeName: 'Post'
})
```

The type name is usually a singular noun, but it can be any valid TypeScript identifier. The collection object key is the data export name; `typeName` is the generated type name.

### `collections[key].pattern`

- Type: `string | string[]`

The glob pattern(s) of the collection files, based on `root`. Multiple patterns are unioned; a pattern prefixed with `!` negates.

```js
const posts = defineCollection({
  pattern: 'posts/*.md'
})

const docs = defineCollection({
  // multiple patterns — later entries win, `!` excludes
  pattern: ['docs/**/*.md', '!docs/drafts/**']
})
```

### `collections[key].exclude`

- Type: `string | string[]`

Patterns to exclude from the matched files (shorthand for adding `!`-prefixed entries to `pattern`).

### `collections[key].single`

- Type: `boolean`
- Default: `false`

Whether the collection is single. If `true`, the collection will be treated as a single file, and the output data will be an object instead of an array.

```js
const site = defineCollection({
  pattern: 'site/index.yml',
  single: true
})
```

### `collections[key].schema`

- Type: `Schema`, See [Schema](../guide/velite-schemas.md) for more information.

The schema of the collection.

```js
import { content, defineCollection, s } from 'velite'

const postContent = content.markdown()
const posts = defineCollection({
  schema: s.object({
    title: s.string(), // from frontmatter
    description: s.string().optional(), // from frontmatter
    excerpt: postContent.excerpt(), // static pre-transform source text
    content: postContent.html() // transformed HTML
  })
})
```

## `markdown`

- Type: `MarkdownOptions`, See [MarkdownOptions](types.md#markdownoptions)

Global Markdown options.

These defaults apply to `content.markdown()` definitions. Scalars resolve as `definition option ?? global option ?? built-in default`; definition-local plugins precede global plugins within each phase, preserving ordinary Unified registration semantics. Definition options belong on `content.markdown(options)`, not on `.html()` / `.toc()` / `.metadata()` selections. See [Content Definitions](../guide/content-executions.md#configuration).

### `markdown.gfm`

- Type: `boolean`
- Default: `true`

Enable GitHub Flavored Markdown (GFM).

### `markdown.removeComments`

- Type: `boolean`
- Default: `true`

Remove html comments.

### `markdown.copyLinkedFiles`

- Type: `boolean`
- Default: `true`

Copy linked files to public path and replace their urls with public urls.

### `markdown.remarkPlugins`

- Type: `PluggableList`, See [PluggableList](https://unifiedjs.com/explore/package/unified/#pluggablelist)
- Default: `[]`

Remark plugins.

### `markdown.rehypePlugins`

- Type: `PluggableList`, See [PluggableList](https://unifiedjs.com/explore/package/unified/#pluggablelist)
- Default: `[]`

Rehype plugins.

## `mdx`

- Type: `MdxOptions`, See [MdxOptions](types.md#mdxoptions)

Global MDX options.

These defaults apply to `content.mdx()` definitions with the same scalar precedence and local-before-global plugin order. Only the documented fields are supported, not arbitrary MDX compiler-option passthrough.

### `mdx.gfm`

- Type: `boolean`
- Default: `true`

Enable GitHub Flavored Markdown (GFM).

### `mdx.removeComments`

- Type: `boolean`
- Default: `true`

Remove MDX expression block comments without removing surrounding content.

### `mdx.copyLinkedFiles`

- Type: `boolean`
- Default: `true`

Copy linked files to public path and replace their urls with public urls.

### `mdx.remarkPlugins` / `mdx.rehypePlugins` / `mdx.recmaPlugins`

- Type: `PluggableList`
- Default: `[]`

User registrations for each phase. Complete Transform includes recma even for TOC-only requests; navigation is withheld if a later recma plugin fails.

### `mdx.minify`

- Type: `boolean`
- Default: `true`

Minify emitted JavaScript with Terser. TOC-only and source-only selections do not serialize or minify.

### `mdx.outputFormat`

- Type: `'program' | 'function-body'`
- Default: `'function-body'`

The compiled JavaScript output format.

### `mdx.development`

- Type: `boolean`
- Default: `false`

Use development MDX compilation.

## `prepare`

- Type: `(collections: PrepareCollections, context: PrepareContext) => Promisable<PrepareResult>`

Where `PrepareCollections = Record<string, unknown[] | unknown>` and `PrepareResult = void | false | { collections: PrepareCollections }`.

The output-oriented `prepare` hook, executed after schema validation and collection aggregation, before the default output is written. It receives the collections map and may:

- mutate the collections in place and return `void` (the mutations are kept);
- return a new `{ collections }` object to replace the current result;
- return `false` to skip the default data output (assets are still emitted).

```js
export default defineConfig({
  collections: { posts, tags },
  prepare: (data, context) => {
    // mutate the result in place
    data.posts.push({ ... })
    data.tags.push({ ... })

    // context.project is a stable view of the resolved project
    const { project } = context

    // the sole way to add diagnostics from the hook:
    context.addDiagnostic({
      key: 'my-warning',
      level: 'warn',
      code: 'MY_CODE',
      message: 'something worth reporting'
    })

    // return false to skip the default data output
  }
})
```

::: tip

`prepare` cannot report diagnostics through its return value — `context.addDiagnostic` is the only channel. Each diagnostic needs a stable `key`; declaring the same key with a different payload is a conflict. See [PrepareContext](types.md#preparecontext).

:::

::: tip

`prepare` only acts on the logical output. Physical output layout (single vs split) and file writes are decided afterwards and are not part of the public config.

:::
