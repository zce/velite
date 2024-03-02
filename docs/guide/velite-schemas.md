# Velite Schemas

To use Zod in Velite, import the `z` utility from `'velite'`. This is a re-export of the Zod library, and it supports all of the features of Zod.

See [Zod's Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

```js
import { z } from 'velite'

// `z` is re-export of Zod
```

In addition, Velite has extended Zod schemas, added some commonly used features when building content models, you can import `s` from `'velite'` to use these extended schemas.

```js
import { s } from 'velite'

// `s` is extended from Zod with some custom schemas,
// `s` also includes all members of zod, so you can use `s` as `z`
```

## `s.isodate()`

`string => string`

format date string to ISO date string.

```ts
date: s.isodate()
// case 1. valid date string
// '2017-01-01' => '2017-01-01T00:00:00.000Z'

// case 2. valid datetime string
// '2017-01-01 10:10:10' => '2017-01-01T10:10:10.000Z'

// case 3. invalid date string
// 'foo bar invalid' => issue 'Invalid date string'
```

## `s.unique(by)`

`string => string`

validate unique value in collections.

```ts
name: s.unique('taxonomies')
// case 1. unique value
// 'foo' => 'foo'

// case 2. non-unique value (in all unique by 'taxonomies')
// 'foo' => issue 'Already exists'
```

### Parameters

#### **by**: unique identifier

- type: `string`
- default: `'global'`

## `s.slug(by, reserved)`

`string => string`

base on `s.unique()`, unique in collections, not allow reserved values, and validate slug format.

```ts
slug: s.slug('taxonomies', ['admin', 'login'])
// case 1. unique slug value
// 'hello-world' => 'hello-world'

// case 2. non-unique value (in all unique by 'taxonomies')
// 'hello-world' => issue 'Slug already exists'

// case 3. reserved slug value
// 'admin' => issue 'Slug is reserved'

// case 4. invalid slug value
// 'Hello World' => issue 'Invalid slug'
```

### Parameters

#### **by**: unique identifier

- type: `string`
- default: `'global'`

#### **reserved**: reserved values

- type: `string[]`
- default: `[]`

## `s.file(options)`

`string => string`

file path relative to this file, copy file to `config.output.assets` directory and return the public url.

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

#### **options**: file options

- type: `FileOptions`, See [FileOptions](#types)
- default: `{ allowNonRelativePath: true }`

### Types

```ts
interface FileOptions {
  /**
   * Allow non-relative path.
   * @default true
   */
  allowNonRelativePath?: boolean
}
```

## `s.image()`

`string => Image`

image path relative to this file, like `s.file()`, copy file to `config.output.assets` directory and return the [Image](#types-1) (image object with meta data).

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

// case 3. absolute path or full url (if allowed)
// '/icon.png' => { src: '/icon.png', width: 0, height: 0, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
// 'https://zce.me/logo.png' => { src: 'https://zce.me/logo.png', width: 0, height: 0, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
```

### Parameters

#### **options**: image options

- type: `ImageOptions`, See [ImageOptions](#types-1)
- default: `{ allowNonRelativePath: false }`

### Types

```ts
interface ImageOptions {
  /**
   * Allow non-relative path.
   * @default false
   */
  allowNonRelativePath?: boolean
}
```

```ts
/**
 * Image object with metadata & blur image
 */
interface Image {
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

parse input or document body as markdown content and return [Metadata](#types-2).

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

```ts
excerpt: s.excerpt()
// document body => excerpt text
```

### Parameters

#### **options**: excerpt options

- type: `ExcerptOptions`, See [ExcerptOptions](#types-3)
- default: `{ length: 260 }`

### Types

```ts
interface ExcerptOptions {
  /**
   * Excerpt length.
   * @default 260
   */
  length?: number
}
```

## `s.markdown(options)`

`string => string`

parse input or document body as markdown content and return html content.

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

parse input or document body as mdx content and return component function-body.

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

```ts
code: s.raw()
// => raw document body
```

## `s.toc(options)`

`string => TocEntry[] | TocTree`

parse input or document body as markdown content and return the table of contents.

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

```ts
path: s.path()
// => flattened path, e.g. 'posts/2021-01-01-hello-world'
```

### Parameters

#### **options**: flattening options

- type: `PathOptions`

##### **options.removeIndex**:

Removes index from path for subfolders

- type: `boolean`
- default: `false`

### Types

```ts
/**
 * Options for flattened path
 * extraction
 */
export interface PathOptions {
  /**
   * removes `index` from the path
   *
   * `/docs/general/index.md` => `docs/general`
   *
   * @default false
   */
  removeIndex?: boolean
}
```

## Zod Primitive Types

In addition, all Zod's built-in schemas can be used normally, such as:

```ts
title: s.string().mix(3).max(100)
description: s.string().optional()
featured: s.boolean().default(false)
```

You can refer to https://zod.dev get complete support documentation.
