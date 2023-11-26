# Field Schemas

To use Zod in Velite, import the `z` utility from `'velite'`. This is a re-export of the Zod library, and it supports all of the features of Zod. See [Zod’s Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

```js
import { z } from 'velite'

// `z` is re-export of Zod
```

In addition, Velite has extended Zod schemas, added some commonly used features when building content models, you can import `s` from `'velite'` to use these extended schemas.

```js
import { s } from 'velite'

// `s` is extended from Zod with some custom schemas, s also includes all members of zod
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
// 'invalid string' => issue 'Invalid date string'
```

## `s.unique(by)`

`string => string`

validate unique value in collection.

```ts
name: s.unique('taxonomies')
// case 1. unique value
// 'foo' => 'foo'

// case 2. non-unique value (in collection)
// 'foo' => issue 'Already exists'
```

### Parameters

**by**: unique identifier

- type: `string`
- default: `global`

## `s.slug(unique, reserved)`

`string => string`

base on `s.unique()`, unique in collection, not allow reserved values, and validate slug format.

```ts
slug: s.slug('taxonomies', ['admin', 'login'])
// case 1. unique slug value
// 'hello-world' => 'hello-world'

// case 2. non-unique value (in collection)
// 'hello-world' => issue 'Slug already exists'

// case 3. reserved slug value
// 'admin' => issue 'Slug is reserved'

// case 4. invalid slug value
// 'Hello World' => issue 'Invalid slug'
```

### Parameters

**unique**: unique identifier

- type: `string`
- default: `global`

**reserved**: reserved values

- type: `string[]`
- default: `[]`

## `s.file()`

`string => string`

file path relative to this file, copy file to `config.output.static` directory and return the public url.

```ts
avatar: s.file()
// case 1. relative path
// 'avatar.png' => '/static/avatar-34kjfdsi.png'

// case 2. non-exists file
// 'not-exists.png' => issue 'File not exists'

// case 3. absolute path or full url
// '/icon.png' => '/icon.png'
// 'https://zce.me/logo.png' => 'https://zce.me/logo.png'
```

## `s.image()`

`string => string | Image`

image path relative to this file, like `s.file()`, copy file to `config.output.static` directory and return the image object with meta data.

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

// case 3. absolute path or full url
// '/icon.png' => '/icon.png'
// 'https://zce.me/logo.png' => 'https://zce.me/logo.png'
```

### Types

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

parse input as markdown content and return metadata.

currently only support `readingTime` & `wordCount`.

```ts
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
metadata: s.metadata()
// => { readingTime: 2, wordCount: 100 }
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

## `s.summary(options)`

`string => string`

parse input as markdown content and return summary plain text.

```ts
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
summary: s.summary()
// => summary plain text
```

### Parameters

**options**: summary options

- type: `SummaryOptions` 👇👇👇
- default: `{ length: 260 }`

### Types

```ts
interface SummaryOptions {
  /**
   * Summary length.
   * @default 260
   */
  length?: number
}
```

## `s.excerpt(options)`

`string => string`

parse input as markdown content and return excerpt html.

```ts
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
excerpt: s.excerpt()
// => excerpt html
```

### Parameters

**options**: excerpt options

- type: `ExcerptOptions` 👇👇👇
- default: `{ separator: 'more', length: 300 }`

### Types

```ts
interface ExcerptOptions {
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
```

## `s.markdown(options)`

`string => string`

parse input as markdown content and return html content.

```ts
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
content: s.markdown()
// => html content
```

### Parameters

**options**: markdown options

- type: `MarkdownOptions` 👇👇👇
- default: `{ gfm: true, removeComments: true, copyLinkedFiles: true }`

### Types

```ts
interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}
```

## `s.mdx(options)`

`string => string`

parse input as mdx content and return component function-body.

```ts
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
code: s.mdx()
// => function-body
```

### Parameters

**options**: mdx options

- type: `MarkdownOptions` 👇👇👇
- default: `{ gfm: true, removeComments: true, copyLinkedFiles: true }`

### Types

```ts
interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}
```

In addition, all Zod’s built-in schemas can be used normally, such as:

```ts
title: s.string().mix(3).max(100)
```

You can refer to https://zod.dev get complete support documentation.
