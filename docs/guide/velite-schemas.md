# Velite Schemas

To use Zod in Velite, import the `s` utility from `'velite'`. It includes all Zod schema helpers plus Velite-specific schemas for content projects.

See [Zod's Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

Use the separate `content` namespace for Markdown/MDX definitions. Their finite methods return ordinary Zod result schemas; they are not members of `s`. See [Content Definitions](content-executions.md) for sharing, input selection, navigation, recovery, and effect boundaries.

```js
import { s } from 'velite'

// `s` includes Zod helpers and Velite custom schemas.
```

## `s.isoDate()`

`string => string`

Format date string to ISO date string.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
date: s.isoDate()
// case 1. valid date string
// '2017-01-01' => '2017-01-01T00:00:00.000Z'

// case 2. valid datetime string
// '2017-01-01 10:10:10' => '2017-01-01T10:10:10.000Z'

// case 3. invalid date string
// 'foo bar invalid' => issue 'Invalid date string'
```

## `s.unique(group)`

`string => string`

Validate a string value that must be unique within a named group.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
name: s.unique('taxonomies')
// case 1. unique value
// 'foo' => 'foo'

// case 2. non-unique value (in all unique by 'taxonomies')
// 'foo' => issue 'duplicate unique value "foo" in group "taxonomies"'
```

### Parameters

#### **group**: unique group name

- type: `string`
- default: `'global'`

## `s.slug(group, reserved)`

`string => string`

Validate a slug string. It checks length (3–200), slug format (`a-z0-9` segments joined by `-`, case-insensitive), reserved values, and uniqueness within a named slug group.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
slug: s.slug('taxonomies', ['admin', 'login'])
// case 1. unique slug value
// 'hello-world' => 'hello-world'

// case 2. non-unique value in the 'taxonomies' slug group
// 'hello-world' => issue 'duplicate unique value "hello-world" in group "slug:taxonomies"'

// case 3. reserved slug value
// 'admin' => issue 'Reserved slug'

// case 4. invalid slug value
// 'Hello World' => issue 'Invalid slug'
```

### Parameters

#### **group**: unique group name

- type: `string`
- default: `'global'`

#### **reserved**: reserved values

- type: `string[]`
- default: `[]`

## `s.file(options)`

`string => string`

file path relative to this file, copy file to `config.output.assets` directory and return the public url.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
avatar: s.file()
// case 1. relative path
// 'avatar.png' => '/static/avatar-34kjfdsi.png'

// case 2. non-exists file
// 'not-exists.png' => fatal 'ASSET_FAILED' diagnostic 'failed to read asset: ...'

// case 3. absolute path or full url (if allowed)
// '/icon.png' => '/icon.png'
// 'https://zce.me/logo.png' => 'https://zce.me/logo.png'
```

### Parameters

##### **options.allowNonRelativePath**:

allow non-relative path, if true, the value will be returned directly, if false, the value will be processed as a relative path

- type: `boolean`
- default: `true`

##### **options.outputName**:

override the global `output.name` filename template for this specific schema invocation

- type: `string`
- default: `undefined` (use `output.name`)

```ts
docs: s.file({ outputName: 'docs/[name]-[hash:8].[ext]' })
```

## `s.image(options)`

`string => ImageData`

Image path relative to the current file, like `s.file()`. Relative images are copied to `config.output.assets` and returned as [ImageData](#types) objects.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
avatar: s.image()
// case 1. relative path
// 'avatar.png' => {
//   src: '/static/avatar-34kjfdsi.png',
//   width: 100,
//   height: 100,
//   blurDataURL: 'data:image/png;base64,xxx',
//   blurWidth: 8,
//   blurHeight: 8
// }

// case 2. non-exists file
// 'not-exists.png' => issue 'failed to read asset: ...'
```

::: warning

Unlike `s.file()`, `s.image()` has no `allowNonRelativePath` passthrough. A `/`-prefixed value is only valid together with `options.absoluteRoot` (resolved against that root, read and probed directly, returned as-is); without `absoluteRoot`, a `/`-prefixed or remote-URL value is treated as a relative reference and fails to resolve. Use a custom schema for remote images.

:::

### Parameters

##### **options.absoluteRoot**:

root path for absolute path, if provided, the value will be processed as an absolute path.

- type: `string`
- default: `undefined`

##### **options.blur**:

blur placeholder options, used to customize the generated `blurDataURL`.

- type: `{ width?: number; height?: number; quality?: number }`
- default: `undefined`

```ts
avatar: s.image({ blur: { width: 16, quality: 30 } })
```

- `blur.width`: blur image width. default: `8`
- `blur.height`: blur image height. default: derived from the image aspect ratio
- `blur.quality`: webp quality of the blur image (1-100). default: `1`

### Types

```ts
/**
 * Image object with metadata & blur image
 */
interface ImageData {
  /**
   * public url of the image
   */
  src: string
  /**
   * image width
   */
  width: number
  /**
   * image height
   */
  height: number
  /**
   * blurDataURL of the image
   */
  blurDataURL: string
  /**
   * blur image width
   */
  blurWidth: number
  /**
   * blur image height
   */
  blurHeight: number
}
```

## `content.markdown(options)`

Create a Markdown definition, then call `.html()`, `.toc()`, `.excerpt(options?)`, or `.metadata()` to construct result schemas. A definition is not a Zod schema.

```ts
import { content, s } from 'velite'

const article = content.markdown()
const schema = s.object({
  html: article.html(),
  toc: article.toc(),
  excerpt: article.excerpt(),
  metadata: article.metadata()
})
```

All four fields intentionally reuse one definition. Their schemas accept an explicit primitive string or derive from the file body when the field is absent. Exactly empty or missing selected content produces `The content is empty`; an explicit empty string never falls back. Processing uses asynchronous Zod parsing in the active record context.

### Definition options

- Type: [`MarkdownDefinitionOptions`](../reference/types.md#content-definition-options).
- Defaults: `gfm`, `removeComments`, and `copyLinkedFiles` are `true`; plugin lists are empty.
- Scalar precedence: definition option, then global `markdown` option, then built-in default.
- User plugins: definition-local registrations before global registrations within each phase.

See [Markdown Support](using-markdown.md) and [configuration ownership](content-executions.md#configuration).

## `content.mdx(options)`

Create an MDX definition with `.code()`, `.toc()`, `.excerpt(options?)`, and `.metadata()`.

```ts
import { content, s } from 'velite'

const article = content.mdx({ minify: false })
const schema = s.object({
  code: article.code(),
  toc: article.toc(),
  excerpt: article.excerpt(),
  metadata: article.metadata()
})
```

`.code()` returns compiled JavaScript as a string, not a rendered component. The default `outputFormat` is `'function-body'`; `'program'` is also supported. Input selection and sharing follow the same explicit-definition contract as Markdown, using MDX syntax regardless of filename extension.

### Definition options

- Type: [`MdxDefinitionOptions`](../reference/types.md#content-definition-options).
- Inherits the Markdown option defaults; `minify` defaults to `true`, `development` to `false`, and `recmaPlugins` to `[]`.
- Scalar precedence uses the global `mdx` options. Local plugins precede global plugins, including recma.
- Only the documented fields are supported, not arbitrary MDX compiler-option passthrough.

See [MDX Support](using-mdx.md).

## `definition.html()` / `definition.code()`

`string | undefined => string`

Markdown `.html()` transforms and serializes the selected source to HTML. MDX `.code()` completes compilation and configured minification. Both assign automatic heading IDs during transformation even without a TOC field. A Markdown definition has no `.code()` method; an MDX definition has no `.html()` method.

## `definition.toc()`

`string | undefined => TocItem[]`

Return flat navigation through statically known **transformed** headings in document order. Each item contains its actual output `id`, not a title slug:

```ts
interface TocItem {
  depth: number
  title: string
  id: string
}
```

TOC needs complete transformation, including MDX recma, but skips serialization/minification. It can resolve linked assets and perform plugin I/O. There are no TOC options or `original` mode. See [actual heading targets](content-executions.md#actual-heading-targets) for ID validity, dynamic MDX limitations, and runtime ID forwarding.

## `definition.excerpt(options)`

`string | undefined => string`

Extract normalized static **pre-transform source text**, not rendered output. `options.length` defaults to `260` Unicode code points and must be a non-negative safe integer; invalid values throw `TypeError` during schema construction. Truncation trims trailing whitespace and appends `…` outside the requested length. Different lengths reuse one execution under the same definition and input.

```ts
const article = content.markdown()
const schema = s.object({
  excerpt: article.excerpt({ length: 160 }),
  longExcerpt: article.excerpt({ length: 300 })
})
```

## `definition.metadata()`

`string | undefined => Metadata`

Analyze complete normalized static **pre-transform source text**, independent of excerpt length or processing plugins. This selection takes no options.

```ts
interface Metadata {
  /** Reading time in minutes, rounded and at least one. */
  readingTime: number
  /** Latin word count plus the fixed CJK character count weighted by 0.56. */
  wordCount: number
}
```

Excerpt and metadata require Parse only; initialization can run plugin attachers, but returned transformers and emission are skipped. Non-empty source without visible text yields `''` and `{ readingTime: 1, wordCount: 0 }`. See [Source Analysis](content-executions.md#source-analysis-versus-navigation) for value rules.

## `s.raw()`

`string => string`

return raw document body.

When the field is missing, this schema returns the current file body.

```ts
code: s.raw()
// => raw document body
```

## `s.path(options)`

`=> string`

get flattened path based on the file path.

When the field is missing, this schema derives the value from the current file path.

```ts
path: s.path()
// => flattened path, e.g. 'posts/2021-01-01-hello-world'
```

### Parameters

#### **options**: flattening options

- type: `PathSchemaOptions`

##### **options.removeIndex**:

Removes `index` from the path.

- type: `boolean`
- default: `true`

## Zod Primitive Types

In addition, all Zod's built-in schemas can be used normally, such as:

```ts
title: s.string().min(3).max(100)
description: s.string().optional()
featured: s.boolean().default(false)
```

You can refer to https://zod.dev get complete support documentation.

## Define a Custom Schema

Refer to [Custom Schema](custom-schema.md) for more information about custom schema.
