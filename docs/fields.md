# Field schemas

Velite provides some commonly used field schemas.

## `s.isodate()`

`string => string`

format date string to ISO date string.

```typescript
date: s.isodate()
// case 1. valid date string
// '2017-01-01' => '2017-01-01T00:00:00.000Z'

// case 2. valid datetime string
// '2017-01-01 10:10:10' => '2017-01-01T10:10:10.000Z'

// case 3. invalid date string
// 'invalid string' => issue 'Invalid date string'
```

## `s.unique(by: string = 'global')`

`string => string`

validate unique value in collection.

```typescript
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

## `s.slug(unique: string = 'global', reserved: string[] = [])`

`string => string`

base on `s.unique()`, unique in collection, not allow reserved values, and validate slug format.

```typescript
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

```typescript
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

```typescript
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

```typescript
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

currently only support `readingTime`.

```typescript
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
metadata: s.metadata()
// => { readingTime: 2 }
```

### Types

```typescript
/**
 * Document metadata.
 */
interface Metadata {
  /**
   * Reading time in minutes.
   */
  readingTime: number
}
```

## `s.excerpt(options: ExcerptOptions = {})`

`string => string`

parse input as markdown content and return excerpt.

```typescript
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
excerpt: s.excerpt()
// => excerpt content
```

### Parameters

**options**: excerpt options

- type: `ExcerptOptions` 👇👇👇
- default: `{ length: 200, format: 'plain' }`

### Types

```typescript
interface ExcerptOptions {
  /**
   * Excerpt separator.
   * @example
   * excerpt({ separator: 'more' }) // split excerpt by `<!-- more -->`
   */
  separator?: string
  /**
   * Excerpt length.
   * @default 200
   */
  length?: number
  /**
   * Excerpt format.
   * @default 'plain'
   */
  format?: 'plain' | 'html'
}
```

## `s.markdown(options: MarkdownOptions = {})`

`string => string`

parse input as markdown content and return html content.

```typescript
// The document body only with the built-in property name: metadata, body, content, summary, excerpt, plain, html, code and raw
content: s.markdown()
// => html content
```

### Parameters

**options**: markdown options

- type: `MarkdownOptions` 👇👇👇
- default: `{ gfm: true, removeComments: true, flattenImage: true }`

### Types

```typescript
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
   * Flatten image paragraph.
   * @default true
   */
  flattenImage?: boolean
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
