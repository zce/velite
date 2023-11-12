# velite

> A tool turns markdown/yaml/json/others files into data layer for static apps with schema.

[![Build Status][actions-img]][actions-url]
[![Coverage Status][codecov-img]][codecov-url]
[![License][license-img]][license-url]
[![NPM Downloads][downloads-img]][downloads-url]
[![NPM Version][version-img]][version-url]
[![Dependency Status][dependency-img]][dependency-url]
[![Code Style][style-img]][style-url]

## TODOs

- [ ] nextjs plugin

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
