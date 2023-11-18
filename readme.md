<div align="center">
  <a href="https://github.com/zce/velite" title="Velite"><img src="docs/logo.svg" width="300" alt="Velite"></a>
  <p>Turns Markdown, YAML, JSON, or other files into an app's data layer based on a schema.</p>
  <p>
    <a href="https://github.com/zce/velite/actions"><img src="https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml" alt="Build Status"></a>
    <a href="https://github.com/zce/velite/blob/master/LICENSE"><img src="https://img.shields.io/github/license/zce/velite" alt="License"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/v/velite" alt="NPM Version"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/node/v/velite" alt="Node Version"></a>
    <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen" alt="Code Style"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/dm/velite" alt="NPM Downloads"></a>
    <a href="https://packagephobia.com/result?p=velite"><img src="https://packagephobia.com/badge?p=velite" alt="Install Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/github/repo-size/zce/velite" alt="Repo Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/librariesio/release/npm/velite" alt="Dependencies Status"></a>
  </p>
  <!-- <p><strong>English</strong> | <a href="readme.zh-cn.md">简体中文</a></p> -->
</div>

:construction: the documentation is not yet complete, but the functionality is mostly stable, although there is still a possibility of significant changes being made.

However, I have provided a full features [example](example) for your reference.

## Introduction

"Velite" comes from the English word "elite".

This is a tool that can turn Markdown, YAML, JSON, or other files into an app's data layer based on a schema.

Inspired by [Contentlayer](https://contentlayer.dev), based on [Zod](https://zod.dev) and [Unified](https://unifiedjs.com), and powered by [ESBuild](https://esbuild.github.io).

> "Velite" itself is the code name for Napoleon's elite army.

### Features

- Easy to use
- Light-weight & High efficiency & Still powerful
- Built-in Markdown, YAML, JSON support
- Built-in relative files & images processing
- Schema validation by [Zod](https://zod.dev)
- Less runtime dependencies
- Configurable & Extensible
- Use modern APIs & TypeScript friendly

### Why not Contentlayer?

[Contentlayer](https://contentlayer.dev) is a great tool, but it is not suitable for my needs. Such as:

- built-in files & images processing
- programmability & extensibility
- schema validation and error reporting friendly
- etc.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (>= 18 required, LTS preferred)

### Installation

```shell
$ npm install velite

# or pnpm
$ pnpm install velite

# or yarn
$ yarn add velite
```

### Quick Start

Create a `velite.config.js` file in the root directory of your project:

```typescript
import { defineConfig, s } from 'velite'

export default defineConfig({
  root: 'content',
  schemas: {
    posts: {
      name: 'Post',
      pattern: 'posts/**/*.md',
      fields: s.object({
        title: s.string().max(99),
        slug: s.slug('post'),
        date: s.isodate(),
        cover: s.image().optional(),
        metadata: s.metadata({ age: 20 }),
        excerpt: s.excerpt({ separator: 'more', format: 'html' }),
        content: s.markdown()
      }).transform(data => ({ ...data, permalink: `/blog/${data.slug}` }))
    }
    others: {
      // ...
    }
  }
})
```

> Config file supports TypeScript, so you can use the full power of TypeScript to write your config file.

Add your creative content to the `content` directory, like this:

```diff
 root
+├── content
+│   ├── posts
+│   │   ├── hello-world.md
+│   │   └── hello-world-2.md
+│   └── others
 ├── public
 ├── package.json
+└── velite.config.js
```

Run the following command:

```shell
$ npx velite
```

Then you will get the following output:

```diff
 root
+├── .velite
+│   ├── posts.json
+│   └── others.json
 ├── content
 │   ├── posts
 │   │   ├── hello-world.md
 │   │   └── hello-world-2.md
 │   └── others
 ├── public
+│   └── static
+│       └── xxx.jpg # from content reference
 ├── package.json
 └── velite.config.js
```

### Example

See [example](example) for more details.

### CLI Help

```shell
$ npx velite --help
velite/0.1.0

Usage:
  $ velite

Commands:
    Build contents for production

Options:
  -c, --config <path>  Use specified config file
  --clean              Clean output directory before build
  --watch              Watch for changes and rebuild
  --verbose            Print additional information
  --debug              Print debug information
  -v, --version        Display version number
  -h, --help           Display this message
```

## Recipes

### Use with Next.js

## Advanced

### Configuration

<!-- TODO:  -->

### Writing a Loader

<!-- TODO:  -->

## API References

<!-- TODO: Introduction of API -->

## Concepts

### How It Works

<!-- TODO: -->

## Roadmap

The following are the features I want to achieve or are under development:

- [ ] More built-in fields
- [ ] Full documentation
- [ ] MDX support (built-in or plugin)
- [ ] Next.js plugin
- [ ] More examples

See the [open issues](https://github.com/zce/caz/issues) for a list of proposed features (and known issues).

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
