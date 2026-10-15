# Define Collections

Content collections are the best way to manage and author content in content-first applications. Velite helps you organize and validate your contents, and provides type-safety through automatic type generations.

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

### `typeName`

The generated TypeScript type name for the collection. The collection's object key in `collections` is the data export name; `typeName` is the type name. Defaults to the collection key.

```js
const posts = defineCollection({
  typeName: 'Post'
})
```

The type name is usually a singular noun, but it can be any valid TypeScript identifier.

### `pattern`

The glob pattern used to find content files for the collection.

```js
const posts = defineCollection({
  pattern: 'posts/**/*.md'
  // or pattern: ['posts/**/*.md', '!posts/private/**']
})
```

Velite uses [tinyglobby](https://github.com/SuperchupuDev/tinyglobby) to find content files, so you can use glob patterns compatible with tinyglobby.

By default, Velite will ignore files and directories that start with `_` or `.`.

### `single`

Whether the collection should be treated as a single item. This is useful for collections that only have one content item, such as a site's metadata.

```js
const site = defineCollection({
  pattern: 'site/index.yml',
  single: true
})
```

### `schema`

Velite uses [Zod](https://zod.dev) to validate the content items in a collection. The `schema` option is used to define the Zod schema used to validate the content items in the collection.

To define schemas in Velite, import the `s` utility from `'velite'`. It includes all Zod schema helpers plus Velite-specific schemas for content projects. See [Zod's Docs](https://zod.dev) for complete documentation on how Zod works and what features are available.

```js
import { s } from 'velite'

const posts = defineCollection({
  schema: s.object({
    title: s.string().max(99)
  })
})
```

::: tip

The schema is usually a `ZodObject`, validating the shape of the content item. But it can be any valid Zod schema.

:::

For more complex schemas, use [Velite extended schemas `s`](velite-schemas.md):

- `s.slug()`: validate slug format, unique in posts collection.
- `s.isoDate()`: format date string to ISO date string.
- `s.unique()`: validate unique value in collection.
- `s.image()`: input image relpath, output image object with blurImage.
- `s.file()`: input file relpath, output file public path.

For Markdown/MDX results, create a [Content Definition](content-executions.md) with `content.markdown()` or `content.mdx()`:

- `.metadata()`: source reading time and weighted word count.
- `.excerpt()`: normalized static pre-transform source text.
- `.toc()`: navigation through transformed headings and actual anchor IDs.
- Markdown `.html()`: generated HTML.
- MDX `.code()`: compiled JavaScript string.

For example:

```js
import { content, defineCollection, s } from 'velite'

const postContent = content.markdown()

const posts = defineCollection({
  schema: s.object({
    slug: s.slug('posts'),
    date: s.isoDate(),
    cover: s.image(),
    video: s.file().optional(),
    metadata: postContent.metadata(),
    excerpt: postContent.excerpt(),
    content: postContent.html()
  })
})
```

For more information about Velite extended field schema, see [Velite Schemas](velite-schemas.md).

## Schema Transform (Computed Fields)

Zod schemas can be transformed using the `.transform()` method. This is useful for adding computed fields to the content items in a collection.

```js
const posts = defineCollection({
  schema: s
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

### Transform Context Metadata

Use `context()` when a transform needs to read the current file or resolved config. This is useful for adding computed fields to the content items in a collection.

```js
import { context, s } from 'velite'

const posts = defineCollection({
  schema: s
    .object({
      // fields
    })
    .transform(data => {
      const { file } = context()
      return {
        ...data,
        // computed fields
        path: file.path, // or parse to filename based slug
        basename: file.path.split(/[\\/]/).pop()
      }
    })
})
```

For more information about accessing file context, see [Custom Schema](custom-schema.md).

## Content Body

Velite's frontmatter loader keeps the raw Markdown/MDX body in `context().file.content`. Use `s.raw()` to retain it as a field. There is no `file.plain`, `file.mdast`, or `file.hast` getter; use a dialect-specific definition for source analysis.

```js
import { defineCollection, s } from 'velite'

const posts = defineCollection({
  schema: s.object({
    raw: s.raw()
  })
})
```

::: tip

This keeps the original document body. To generate HTML or MDX code, use a Content Definition's `.html()` or `.code()` schema instead.

:::

### Markdown & MDX

In addition to validating the content items in a collection, Velite can also process the content body using [Unified](https://unifiedjs.com).

```js
import { content, defineCollection, s } from 'velite'

const postContent = content.markdown()
const posts = defineCollection({
  schema: s.object({
    content: postContent.html() // for MDX: content.mdx().code()
  })
})
```

The `content` field will be transformed from markdown to html, and the result will be available in the `content` field of the content item.

#### Reference

- [`content.markdown(options)`](velite-schemas.md#content-markdown-options)
- [`content.mdx(options)`](velite-schemas.md#content-mdx-options)

### Metadata

Velite can extract metadata from content files. This is useful for adding computed fields to the content items in a collection.

```js
import { content, defineCollection, s } from 'velite'

const postContent = content.markdown()
const posts = defineCollection({
  schema: s.object({
    metadata: postContent.metadata() // source reading time and weighted word count
  })
})
```

#### Reference

- [`definition.metadata()`](velite-schemas.md#definition-metadata)

### Excerpt

Velite can extract excerpt from content files. This is useful for adding computed fields to the content items in a collection.

```js
import { content, defineCollection, s } from 'velite'

const postContent = content.markdown()
const posts = defineCollection({
  schema: s.object({
    excerpt: postContent.excerpt({ length: 200 }) // static pre-transform source text
  })
})
```

#### Reference

- [`definition.excerpt(options)`](velite-schemas.md#definition-excerpt-options)

Source excerpt and metadata are available without a generated-content field. Reuse the same definition when adding related selections; do not create separate equal-looking definitions expecting shared work. TOC describes transformed headings rather than a source outline. See [Content Definitions](content-executions.md) for input selection, navigation, and native Zod wrapper behavior.
