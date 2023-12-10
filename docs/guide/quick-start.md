# Quick Start

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) version 18.17 or higher, LTS version is recommended.
- macOS, Windows, and Linux are supported.

::: code-group

```sh [npm]
$ npm install velite -D
```

```sh [pnpm]
$ pnpm add velite -D
```

```sh [yarn]
$ yarn add velite -D
```

```sh [bun]
$ bun add velite -D
```

:::

::: tip Velite is an [ESM-only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) package

Don't use `require()` to import it, and make sure your nearest `package.json` contains `"type": "module"`, or change the file extension of your relevant files like `velite.config.js` to `.mjs`/`.mts`. Also, inside async CJS contexts, you can use `await import('velite')` instead.

:::

## Define Collections

Create a `velite.config.js` file in the root directory of your project to define collections config:

```js
import { defineConfig, s } from 'velite'

// `s` is extended from Zod with some custom schemas,
// you can also import re-exported `z` from `velite` if you don't need these extension schemas.

export default defineConfig({
  collections: {
    posts: {
      name: 'Post', // collection type name
      pattern: 'posts/**/*.md', // content files glob pattern
      schema: s
        .object({
          title: s.string().max(99), // Zod primitive type
          slug: s.slug('posts'), // validate format, unique in posts collection
          date: s.isodate(), // input Date-like string, output ISO Date string.
          cover: s.image().optional(), // input image relpath, output image object with blurImage.
          video: s.file().optional(), // input file relpath, output file public path.
          metadata: s.metadata(), // extract markdown reading-time, word-count, etc.
          excerpt: s.excerpt(), // excerpt of markdown content
          content: s.markdown() // transform markdown to html
        })
        // more additional fields (computed fields)
        .transform(data => ({ ...data, permalink: `/blog/${data.slug}` }))
    },
    others: {
      // other collection schema options
    }
  }
})
```

For more information about Velite extended field schemas, see [Velite Schemas](velite-schemas.md).

::: tip

Config file supports TypeScript & ESM & CommonJS. you can use the full power of TypeScript to write your config file, and it's recommended strongly.

:::

## Create Contents Files

Add your creative content into the `content` directory, like this:

```diff
 root
+├── content
+│   ├── posts
+│   │   └── hello-world.md
+│   └── others
+│       └── other.yml
 ├── public
 ├── package.json
 └── velite.config.js
```

::: details content/posts/hello-world.md

```md
---
title: Hello world
slug: hello-world
date: 1992-02-25 13:22
cover: cover.jpg
video: video.mp4
---

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse

![some image](img.png)

[link to file](plain.txt)
```

:::

## Build Contents by Velite

Run `velite` command in terminal, then Velite will build the contents and related files.

::: code-group

```sh [npm]
$ npx velite
```

```sh [pnpm]
$ pnpm velite
```

```sh [yarn]
$ yarn velite
```

```sh [bun]
$ bun velite
```

:::

Then you will get the following output:

```diff
 root
+├── .velite
+│   ├── posts.json                  # posts collection output
+│   ├── others.json                 # others collection output
+│   ├── index.d.ts                  # typescript dts file
+│   └── index.js                    # javascript entry file (esm)
 ├── content
 │   ├── posts
 │   │   ├── hello-world.md
 │   │   └── other.md
 │   └── others
 │       └── other.yml
 ├── public
+│   └── static
+│       ├── cover-2a4138dh.jpg      # from frontmatter reference
+│       ├── img-2hd8f3sd.jpg        # from content reference
+│       ├── plain-37d62h1s.txt      # from content reference
+│       └── video-72hhd9f.mp4       # from frontmatter reference
 ├── package.json
 └── velite.config.js
```

::: tip

If you're using Git for version control, we recommend ignoring the `.velite` directory by adding `.velite` to your `.gitignore`. This tells Git to ignore this directory and any files inside of it.

```sh
echo '\n.velite' >> .gitignore
```

:::

## Run Velite with Watch Mode

Run `velite dev` or `velite` with `--watch` option, then Velite will watch the contents files and rebuild them automatically when they are changed.

::: code-group

```sh [npm]
$ npx velite dev
[VELITE] output 2 pages, 3 others
[VELITE] build finished in 284.67ms
[VELITE] watching for changes in './content'
```

```sh [pnpm]
$ pnpm velite dev
[VELITE] output 2 pages, 3 others
[VELITE] build finished in 284.67ms
[VELITE] watching for changes in './content'
```

```sh [yarn]
$ yarn velite dev
[VELITE] output 2 pages, 3 others
[VELITE] build finished in 284.67ms
[VELITE] watching for changes in './content'
```

```sh [bun]
$ bun velite dev
[VELITE] output 2 pages, 3 others
[VELITE] build finished in 284.67ms
[VELITE] watching for changes in './content'
```

:::

For more information about define collections, see [Define Collections](define-collections.md).

## Use Output in Your Project

Velite will generate a `index.js` file in `.velite` directory, you can import it in your project:

```js
import { getPosts } from './.velite'

const posts = await getPosts()

console.log(posts) // => [{ title: 'Hello world', slug: 'hello-world', ... }, ...]
```

::: tip

Velite is Framework Agnostic, you can use it output with any framework or library you like.

:::

For more information about using collections, see [Using Collections](using-collections.md).
