---
outline: deep
---

# Configuration

When running `velite` from the command line, Velite will automatically try to resolve a config file named `velite.config.js` inside project root (other JS and TS extensions are also supported).

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

In addition, Velite also provides a `UserConfig` type to describe the config file type.

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

The root directory of the contents, relative to resolved config file.

#### `strict`

- Type: `boolean`
- Default: `false`

If true, throws an error and terminates the process if any schema validation fails. Otherwise, a warning is logged but the process does not terminate.

## `output`

- Type: `object`

The output configuration.

### `output.data`

- Type: `string`
- Default: `'.velite'`

The output directory of the data files, relative to resolved config file.

### `output.assets`

- Type: `string`
- Default: `'public/static'`

The directory of the assets, relative to resolved config file. This directory should be served statically by the app.

### `output.base`

- Type: `` '/' | `/${string}/` | `.${string}/` | `${string}:${string}/` ``
- Default: `'/static/'`

The public base path of the assets. This option is used to generate the asset URLs. It should be the same as the `base` option of the app and end with a slash.

### `output.name`

- Type: `string`
- Default: `'[name]-[hash:8].[ext]'`

This option determines the name of each output asset. The asset will be written to the directory specified in the `output.assets` option. You can use `[name]`, `[hash]` and `[ext]` template strings with specify length.

<!-- ### `output.ignore`

- Type: `string[]`
- Default: `[]`

The extensions blacklist of the assets, such as `['.md', '.yml']`, will be ignored when copy assets to output directory. -->

### `output.clean`

- Type: `boolean`
- Default: `false`

Whether to clean the output directories before build.

### `output.format`

- Type: `'esm' | 'cjs'`
- Default: `'esm'`

The output format of the entry file.

## `collections`

- Type: `{ [name: string]: Collection }`

The collections definition.

### `collections[name].name`

- Type: `string`

The name of the collection. This is used to generate the type name for the collection.

```js
const posts = defineCollection({
  name: 'Post'
})
```

The type name is usually a singular noun, but it can be any valid TypeScript identifier.

### `collections[name].pattern`

- Type: `string`

The glob pattern of the collection files, based on `root`.

```js
const posts = defineCollection({
  pattern: 'posts/*.md'
})
```

### `collections[name].single`

- Type: `boolean`
- Default: `false`

Whether the collection is single. If `true`, the collection will be treated as a single file, and the output data will be an object instead of an array.

```js
const site = defineCollection({
  pattern: 'site/index.yml',
  single: true
})
```

### `collections[name].schema`

- Type: `Schema`, See [Schema](../guide/velite-schemas.md) for more information.

The schema of the collection.

```js
const posts = defineCollection({
  schema: s.object({
    title: s.string(), // from frontmatter
    description: s.string().optional(), // from frontmatter
    excerpt: s.string(), // from markdown body,
    content: s.string() // from markdown body
  })
})
```

## `loaders`

- Type: `Loader[]`, See [Loader](types.md#loader)
- Default: `[]`, built-in loaders: `'json'`, `'yaml'`, `'matter'`

The file loaders. You can use it to load files that are not supported by Velite. For more information, see [Custom Loaders](../guide/custom-loader.md).

## `markdown`

- Type: `MarkdownOptions`, See [MarkdownOptions](types.md#markdownoptions)

Global Markdown options.

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

### `mdx.gfm`

- Type: `boolean`
- Default: `true`

Enable GitHub Flavored Markdown (GFM).

### `mdx.removeComments`

- Type: `boolean`
- Default: `true`

Remove html comments.

### `mdx.copyLinkedFiles`

- Type: `boolean`
- Default: `true`

Copy linked files to public path and replace their urls with public urls.

More options, see [MDX Compile Options](https://mdxjs.com/packages/mdx/#compileoptions).

## `prepare`

- Type: `(data: Result<Collections>, context: Context) => Promisable<void | false>`

Data prepare hook, executed before write to file. You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files. return false to prevent the default output to a file if you wanted.

```js
export default defineConfig({
  collections: { posts, tags },
  prepare: (data, context) => {
    // modify data
    data.posts.push({ ... })
    data.tags.push({ ... })

    // context
    const { config } = context
    // config is resolved from `velite.config.js` with default values

    // return false to prevent the default output to a file
  }
})
```

## `complete`

- Type: `(data: Result<Collections>, context: Context) => Promisable<void>`

Build success hook, executed after the build is complete. You can do anything after the build is complete, such as print some tips or deploy the output files.
