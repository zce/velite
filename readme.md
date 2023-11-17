# :construction: velite

> Turns Markdown, YAML, JSON, or other files into an app's data layer based on a schema.

[![Build Status][actions-img]][actions-url]
[![License][license-img]][license-url]
[![NPM Downloads][downloads-img]][downloads-url]
[![NPM Version][version-img]][version-url]
[![Code Style][style-img]][style-url]

The documentation is not yet complete, but the functionality is mostly stable, although there is still a possibility of significant changes being made.

However, I have provided a complete [example](example) for your reference.

## TODOs

- [x] typescript or esm config
- [x] markdown & yaml & json built-in support
- [x] remark plugins & rehype plugins
- [x] example
- [x] watch
- [ ] excerpt & plain
- [ ] metadata field (reading-time, word-count, etc.)
- [ ] mdx
- [ ] reference parent
- [ ] nextjs plugin
- [ ] types generate
- [ ] image command (compress, resize, etc.)
- [ ] docs

## Backups

```typescript
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'
import remarkGfm from 'remark-gfm'
import z from 'zod'

import remarkFlattenImage from '../plugins/remark-flatten-image'
import remarkFlattenListItem from '../plugins/remark-flatten-listitem'
import remarkRemoveComments from '../plugins/remark-remove-comments'

import type { PluggableList } from 'unified'

interface MdxBody {
  plain: string
  excerpt: string
  code: string
}

interface MdxOptions {
  gfm?: boolean
  removeComments?: boolean
  flattenImage?: boolean
  flattenListItem?: boolean
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

// https://github.com/kentcdodds/mdx-bundler/blob/v10.0.0/src/index.js
export const mdx = ({ gfm = true, removeComments = true, flattenImage = true, flattenListItem = true, remarkPlugins = [], rehypePlugins = [] }: MdxOptions = {}) => {
  if (gfm) remarkPlugins.push(remarkGfm)
  if (removeComments) remarkPlugins.push(remarkRemoveComments)
  if (flattenImage) remarkPlugins.push(remarkFlattenImage)
  if (flattenListItem) remarkPlugins.push(remarkFlattenListItem)

  return z.string().transform(async (value, ctx): Promise<MdxBody> => {
    const path = ctx.path[0] as string

    // const output = getOutputConfig()

    const entryFile = join(dirname(path), `_mdx_entry_point-${Math.random()}.mdx`)
    try {
      await writeFile(entryFile, value)

      const bundled = await build({
        entryPoints: [entryFile],
        write: false,
        bundle: false,
        format: 'iife',
        globalName: 'Component',
        plugins: [
          mdxPlugin({
            remarkPlugins,
            rehypePlugins
          })
        ]
      })

      return {
        plain: value as string,
        excerpt: value as string,
        code: bundled.outputFiles[0].text
      }
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return {} as MdxBody
    } finally {
      await rm(entryFile, { force: true })
    }
  })
}
```

## Installation

```shell
$ npm install velite

# or pnpm
$ pnpm install velite

# or yarn
$ yarn add velite
```

## Usage

<!-- TODO: Introduction of Usage -->

```javascript
import { defineConfig, shared, z } from 'velite'

export default defineConfig({
  root: 'content',
  output: {
    data: 'dist',
    static: 'dist/static',
    base: '/static'
  },
  schemas: {
    posts: {
      name: 'Post',
      pattern: 'posts/**/*.md',
      fields: z
        .object({
          title: shared.title,
          slug: shared.slug,
          date: shared.date,
          cover: shared.image,
          description: shared.paragraph,
          draft: z.boolean().default(false),
          meta: shared.meta,
          raw: z.string(),
          plain: z.string(),
          excerpt: z.string(),
          html: z.string()
        })
        .transform(data => ({ ...data, permalink: `/blog/${data.slug}` }))
    }
  },
  callback: ({ posts }) => {}
})
```

## API

<!-- TODO: Introduction of API -->

### velite(input, options?)

#### input

- Type: `string`
- Details: name string

#### options

##### host

- Type: `string`
- Details: host string
- Default: `'zce.me'`

## CLI Usage

<!-- TODO: Introduction of CLI -->

Use npx:

```shell
$ npx velite <input> [options]
```

Globally install:

```shell
$ npm install velite -g
# or yarn
$ yarn global add velite
```

```shell
$ velite --help
velite/0.1.0

Usage:
  $ velite <input>

Commands:
  <input>  Sample cli program

For more info, run any command with the `--help` flag:
  $ velite --help

Options:
  --host <host>  Sample options
  -h, --help     Display this message
  -v, --version  Display version number

Examples:
  $ velite w --host zce.me
```

## Related

- [zce/caz](https://github.com/zce/caz) - A simple yet powerful template-based Scaffolding tools.

## Contributing

1. **Fork** it on GitHub!
2. **Clone** the fork to your own machine.
3. **Checkout** your feature branch: `git checkout -b my-awesome-feature`
4. **Commit** your changes to your own branch: `git commit -am 'Add some feature'`
5. **Push** your work back up to your fork: `git push -u origin my-awesome-feature`
6. Submit a **Pull Request** so that we can review your changes.

> **NOTE**: Be sure to merge the latest from "upstream" before making a pull request!

## License

[MIT](LICENSE) &copy; [zce](https://zce.me)

[actions-img]: https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml
[actions-url]: https://github.com/zce/velite/actions
[codecov-img]: https://img.shields.io/codecov/c/github/zce/velite
[codecov-url]: https://codecov.io/gh/zce/velite
[license-img]: https://img.shields.io/github/license/zce/velite
[license-url]: https://github.com/zce/velite/blob/master/LICENSE
[downloads-img]: https://img.shields.io/npm/dm/velite
[downloads-url]: https://npm.im/velite
[version-img]: https://img.shields.io/npm/v/velite
[version-url]: https://npm.im/velite
[dependency-img]: https://img.shields.io/librariesio/github/zce/velite
[dependency-url]: https://github.com/zce/velite
[style-img]: https://img.shields.io/badge/code_style-standard-brightgreen
[style-url]: https://standardjs.com
