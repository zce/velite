# Velite Schemas

To use Zod in Velite, import the `s` utility from `'velite'`. It includes all Zod schema helpers plus Velite-specific schemas for content projects.

See [Zod's Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

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
// 'foo' => issue 'Duplicate 'foo' with '/path/to/existing/file.yml''
```

### Parameters

#### **group**: unique group name

- type: `string`
- default: `'global'`

## `s.slug(group, reserved)`

`string => string`

Validate a slug string. It checks length, slug format, reserved values, and uniqueness within a named slug group.

This schema requires an input value. Add `.optional()` in your collection schema if the field itself is optional.

```ts
slug: s.slug('taxonomies', ['admin', 'login'])
// case 1. unique slug value
// 'hello-world' => 'hello-world'

// case 2. non-unique value in the 'taxonomies' slug group
// 'hello-world' => issue "duplicate value 'hello-world' ..."

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
// 'not-exists.png' => issue 'File not exists'

// case 3. absolute path or full url (if allowed)
// '/icon.png' => '/icon.png'
// 'https://zce.me/logo.png' => 'https://zce.me/logo.png'
```

### Parameters

##### **options.allowNonRelativePath**:

allow non-relative path, if true, the value will be returned directly, if false, the value will be processed as a relative path

- type: `boolean`
- default: `true`

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
// 'not-exists.png' => issue 'File not exists'

// case 3. absolute path or full URL
// '/icon.png' => { src: '/icon.png', width: 0, height: 0, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
// 'https://zce.me/logo.png' => { src: 'https://zce.me/logo.png', width: 0, height: 0, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
```

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

## `s.metadata()`

`string => Metadata`

parse input or document body as markdown content and return [Metadata](#types-1).

When the field is missing, this schema derives metadata from the current file's plain text.

currently only support `readingTime` & `wordCount`.

```ts
metadata: s.metadata()
// document body => { readingTime: 2, wordCount: 100 }
```

### Types

```ts
/**
 * Document metadata.
 */
interface Metadata {
  /**
   * Reading time in minutes.
   */
  readingTime: number
  /**
   * Word count.
   */
  wordCount: number
}
```

## `s.excerpt(options)`

`string => string`

parse input or document body as markdown content and return excerpt text.

When the field is missing, this schema derives the excerpt from the current file's plain text.

```ts
excerpt: s.excerpt()
// document body => excerpt text
```

### Parameters

#### **options**: excerpt options

##### **options.length**:

excerpt length.

- type: `number`
- default: `260`

## `s.markdown(options)`

`string => string`

parse input or document body as markdown content and return html content. refer to [Markdown Support](using-markdown.md) for more information.

When the field is missing, this schema compiles the current file body.

```ts
content: s.markdown()
// => html content
```

### Parameters

#### **options**: markdown options

- type: `MarkdownOptions`, See [MarkdownOptions](../reference/types.md#markdownoptions)
- default: `{ gfm: true, removeComments: true, copyLinkedFiles: true }`

## `s.mdx(options)`

`string => string`

parse input or document body as mdx content and return component function-body. refer to [MDX Support](using-mdx.md) for more information.

When the field is missing, this schema compiles the current file body.

```ts
code: s.mdx()
// => function-body
```

### Parameters

#### **options**: mdx options

- type: `MdxOptions`, See [MdxOptions](../reference/types.md#mdxoptions)
- default: `{ gfm: true, removeComments: true, copyLinkedFiles: true }`

## `s.raw()`

`string => string`

return raw document body.

When the field is missing, this schema returns the current file body.

```ts
code: s.raw()
// => raw document body
```

## `s.toc(options)`

`string => TocEntry[] | TocTree`

parse input or document body as markdown content and return the [table of contents](#types-2).

When the field is missing, this schema derives the table of contents from the current file body.

```ts
toc: s.toc()
// document body => table of contents
```

### Parameters

#### **options**: toc options

- type: `TocOptions`, See [Options](https://github.com/syntax-tree/mdast-util-toc?tab=readme-ov-file#options)

##### **options.original**:

keep the original table of contents.

- type: `boolean`
- default: `false`

### Types

```ts
interface TocEntry {
  /**
   * Title of the entry
   */
  title: string
  /**
   * URL that can be used to reach
   * the content
   */
  url: string
  /**
   * Nested items
   */
  items: TocEntry[]
}

/**
 * Tree for table of contents
 */
export interface TocTree {
  /**
   *  Index of the node right after the table of contents heading, `-1` if no
   *  heading was found, `undefined` if no `heading` was given.
   */
  index?: number
  /**
   *  Index of the first node after `heading` that is not part of its section,
   *  `-1` if no heading was found, `undefined` if no `heading` was given, same
   *  as `index` if there are no nodes between `heading` and the first heading
   *  in the table of contents.
   */
  endIndex?: number
  /**
   *  List representing the generated table of contents, `undefined` if no table
   *  of contents could be created, either because no heading was found or
   *  because no following headings were found.
   */
  map?: List
}
```

Refer to [mdast-util-toc](https://github.com/syntax-tree/mdast-util-toc) for more information about `Result` and `Options`.

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

- type: `PathOptions`

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
