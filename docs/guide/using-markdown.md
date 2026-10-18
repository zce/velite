# Markdown

Markdown is a lightweight markup language with plain text formatting syntax. It is designed so that it can be converted to HTML and many other formats using a tool by the same name. Markdown is often used to format readme files, for writing messages in online discussion forums, and to create rich text using a plain text editor.

::: tip Markdown or MDX

Markdown has top-level support in Velite. Although we also support MDX, I think that MDX is not the best choice for content creators. Although it is powerful and has stronger programmability, it is easy to lose the essence of writing and recording, and become addicted to technology.

- **Portable**: Markdown is portable, you can use it anywhere, even in the terminal.
- **Simple**: Markdown is simple, you can learn it in 10 minutes, don't need to spend a lot of time to learn React.
- **Easy to use**: Markdown is easy to use, you can use it to write documents, write blogs, and even write books.
- **Stronger by extension**: Markdown is extensible, you can use it to write code, write math formulas, and even write music.

:::

## Generate HTML and related results

Create one definition for the related selections of a document:

```ts
import { content, defineConfig, s } from 'velite'

const article = content.markdown()

export default defineConfig({
  collections: {
    posts: {
      pattern: 'posts/**/*.md',
      schema: s.object({
        title: s.string(),
        html: article.html(),
        toc: article.toc(),
        excerpt: article.excerpt(),
        metadata: article.metadata()
      })
    }
  }
})
```

An absent result field selects the file body; an explicit string overrides it. Reusing the same definition and exact selected text within a record shares one execution. Global `markdown` options remain available, while definition-local options override scalars and local plugins precede global plugins.

Generated HTML automatically carries heading IDs during transformation, even without a TOC field. TOC is a flat array of `{ depth, title, id }` for transformed headings and their actual targets, not a source outline or independently calculated slugs. Plugins can add, remove, or retarget headings. Legal unique explicit IDs are preserved; invalid or duplicate explicit IDs produce content validation issues.

Excerpt and metadata describe normalized static pre-transform source text. TOC requires complete transformation but skips HTML serialization, so it may still resolve linked assets or perform plugin I/O. See [Content Definitions](content-executions.md) for native wrappers, conditional derivation, recovery, and effect boundaries.
