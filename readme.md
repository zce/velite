<div align="center">
  <h1><a href="https://github.com/zce/velite"><img src="docs/logo.svg" width="300" alt="VELITE"></a></h1>
  <p>Turns Markdown, YAML, JSON, or other files into an app's data layer based on a schema.</p>
  <p>
    <a href="https://github.com/zce/velite/actions"><img src="https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml" alt="Build Status"></a>
    <!-- <a href="https://codecov.io/gh/zce/velite"><img src="https://img.shields.io/codecov/c/github/zce/velite" alt="Coverage Status"></a> -->
    <a href="https://github.com/zce/velite/blob/master/LICENSE"><img src="https://img.shields.io/github/license/zce/velite" alt="License"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/v/velite" alt="NPM Version"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/node/v/velite" alt="Node Version"></a>
    <br>
    <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen" alt="Code Style"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/dm/velite" alt="NPM Downloads"></a>
    <a href="https://packagephobia.com/result?p=velite"><img src="https://packagephobia.com/badge?p=velite" alt="Install Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/github/repo-size/zce/velite" alt="Repo Size"></a>
    <!-- <a href="https://github.com/zce/velite"><img src="https://img.shields.io/librariesio/github/zce/velite" alt="Dependencies Status"></a> -->
  </p>
  <!-- <p><strong>English</strong> | <a href="readme.zh-cn.md">简体中文</a></p> -->
</div>

:construction: he documentation is not yet complete, but the functionality is mostly stable, although there is still a possibility of significant changes being made.

However, I have provided a complete [example](example) for your reference.

## Introduction

"Velite" comes from the English word "elite".

> "Velite" itself is the code name for Napoleon's elite army.

### Features

- Easy to use
- Light-weight
- Still powerful
- High efficiency
- Less runtime dependencies
- Configurable
- TypeScript support
- ESM

## TODOs

- [x] typescript or esm config
- [x] markdown & yaml & json built-in support
- [x] remark plugins & rehype plugins
- [x] watch
- [x] excerpt ~~& plain~~
- [x] metadata field (reading-time, ~~word-count, etc.~~)
- [x] types generate // https://github.com/sachinraja/zod-to-ts/issues/59
- [ ] example with nextjs
- [ ] mdx
- [ ] reference parent
- [ ] nextjs plugin
- [ ] image command (compress, resize, etc.)
- [ ] docs

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

## API

<!-- TODO: Introduction of API -->

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

## Backups

```typescript
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'
import remarkGfm from 'remark-gfm'
import { z } from 'zod'

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

[MIT](license) &copy; [zce](https://zce.me)

[actions-img]: https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml
[actions-url]: https://github.com/zce/velite/actions
[license-img]: https://img.shields.io/github/license/zce/velite
[license-url]: https://github.com/zce/velite/blob/master/license
[version-img]: https://img.shields.io/npm/v/velite
[version-url]: https://npm.im/velite
[downloads-img]: https://img.shields.io/npm/dm/velite
[downloads-url]: https://npm.im/velite
[style-img]: https://img.shields.io/badge/code_style-standard-brightgreen
[style-url]: https://standardjs.com
