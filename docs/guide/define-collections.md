# Define Collections

Content collections are the best way to manage and author content in content-first applications. Velite help to organize and validate your your contents, and provide automatic TypeScript type-safety for all of your contents.

## What is a Collection?

A **content collection** is a group of related content items. For example, a blog might have a collection of **posts**, a collection of **authors**, and a collection of **tags**.

Each collection should be placed in a top-level directory inside the `content` project directory.

```diff{2,5,8}
content
├── authors # => authors collection
│   ├── zce.yml
│   └── jane.yml
├── posts # => posts collection
│   ├── hello-world.md
│   └── another-post.md
└── tags # => tags collection
    └── all-in-one.yml
```

Each collection is defined by a schema, which describes the shape of the content items in the collection.

```js
import { defineCollection, defineConfig, s } from 'velite'

const posts = defineCollection({
  /* collection shema options */
})

const authors = defineCollection({
  /* collection shema options */
})

const tags = defineCollection({
  /* collection shema options */
})

export default defineConfig({
  collections: { authors, posts, tags }
})
```

## Collection Schema Options

### `name`

The name of the collection. This is used to generate the type name for the collection.

```js
const posts = defineCollection({
  name: 'Post'
})
```

The type name is usually a singular noun, but it can be any valid TypeScript identifier.

### `pattern`

The glob pattern used to find content files for the collection.

```js
const posts = defineCollection({
  pattern: 'posts/**/*.md'
})
```

Velite uses [fast-glob](https://github.com/mrmlnc/fast-glob) to find content files, so you can use any glob pattern supported by fast-glob.

By default, Velite will ignore files and directories that start with `_` or `.`.

### `single`

Whether the collection should be treated as a single item. This is useful for collections that only have one content item, such as a site’s metadata.

```js
const site = defineCollection({
  pattern: 'site/index.yml'
  single: true
})
```

### `schema`

Velite uses [Zod](https://zod.dev) to validate the content items in a collection. The `schema` option is used to define the Zod schema used to validate the content items in the collection.

To use Zod in Velite, import the `z` utility from `'velite'`. This is a re-export of the Zod library, and it supports all of the features of Zod. See [Zod’s Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

```js
const posts = defineCollection({
  schema: z.object({
    title: z.string().max(99)
  })
})
```

::: tip
The schema is usually a `ZodObject`, validating the shape of the content item. But it can be any valid Zod schema.
:::

For more useful schemas, I recommend that you use [Velite extended schemas `s`](velite-shemas.md):

- `s.slug()`: validate slug format, unique in posts collection.
- `s.isodate()`: format date string to ISO date string.
- `s.unique()`: validate unique value in collection.
- `s.image()`: input image relpath, output image object with blurImage.
- `s.file()`: input file relpath, output file public path.
- `s.metadata()`: extract markdown reading-time, word-count, etc.
- `s.summary()`: summary of markdown content (plain text)
- `s.excerpt()`: excerpt of markdown content (html)
- `s.markdown()`: transform markdown to html
- `s.mdx()`: transform mdx to function code.

For example:

```js
import { s } from 'velite'

const posts = defineCollection({
  schema: z.object({
    slug: s.slug('posts'),
    date: s.isodate(),
    cover: s.image(),
    video: s.file().optional(),
    metadata: s.metadata(),
    summary: s.summary(),
    excerpt: s.excerpt(),
    content: s.markdown()
  })
})
```

For more information about Velite extended field schema, see [Velite Schemas](velite-shemas.md).

## Schema Transform (Computed Fields)

Zod schemas can be transformed using the `.transform()` method. This is useful for adding computed fields to the content items in a collection.

```js
const posts = defineCollection({
  schema: z
    .object({
      slug: s.slug('posts')
    })
    .transform(data => ({
      ...data,
      // computed fields
      permalink: `/blog/${data.slug}`
    }))
})
```

## Content Body

Velite built-in Loader keep content raw body with multiple keys to adapt to more personalized situations.

Except for the `content` field, the original document body can be accessed by the `metadata` / `raw` / `body` / `summary` / `excerpt` / `plain` / `html` / `code` field.

```js
const posts = defineCollection({
  schema: z.object({
    content: s.string(),
    metadata: s.string(),
    raw: s.string(),
    body: s.string(),
    summary: s.string(),
    excerpt: s.string(),
    plain: s.string(),
    html: s.string(),
    code: s.string()
  })
})
```

`s.string()` schema will keep the original document body, In most cases, you should use `s.markdown()` / `s.mdx()` schema to transform the document body.

### Markdown & MDX

In addition to validating the content items in a collection, Velite can also process the content body using [Unified](https://unifiedjs.com).

```js
const posts = defineCollection({
  schema: z.object({
    content: s.markdown() // or s.mdx()
  })
})
```

The `content` field will be transformed from markdown to html, and the result will be available in the `content` field of the content item.

### Metadata

Velite can extract metadata from content files. This is useful for adding computed fields to the content items in a collection.

```js
const posts = defineCollection({
  schema: z.object({
    metadata: s.metadata() // extract markdown reading-time, word-count, etc.
  })
})
```

### Excerpt

Velite can extract excerpt from content files. This is useful for adding computed fields to the content items in a collection.

```js
const posts = defineCollection({
  schema: z.object({
    summary: s.summary() // excerpt of markdown summary (plain text)
    excerpt: s.excerpt() // excerpt of markdown content (html)
  })
})
```
