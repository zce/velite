# Quick Start

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) version 18.17 or higher, LTS version is recommended.
- macOS, Windows are supported, Linux is not supported yet.

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

<!-- ::: details Getting missing peer deps warnings?
If using PNPM, you will notice a missing peer warning for `@docsearch/js`. This does not prevent VitePress from working. If you wish to suppress this warning, add the following to your `package.json`:
::: -->

## Define Collections

Create a `velite.config.js` file in the root directory of your project to define collections config:

```js
import { defineConfig, s } from 'velite'

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
          summary: s.summary(), // summary of markdown content (plain text)
          excerpt: s.excerpt(), // excerpt of markdown content (html)
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

> `s` is extended from Zod with some custom schemas, you can also import original `z` from `velite` if you don't need these extension schemas.

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
+│   ├── posts.json
+│   └── others.json
 ├── content
 │   ├── posts
 │   │   ├── hello-world.md
 │   │   └── hello-world-2.md
 │   └── others
 ├── public
+│   └── static
+│       ├── cover-2a4138dh.jpg # from frontmatter reference
+│       ├── img-2hd8f3sd.jpg # from content reference
+│       ├── plain-37d62h1s.txt # from content reference
+│       └── video-72hhd9f.mp4 # from frontmatter reference
 ├── package.json
 └── velite.config.js
```

::: details .velite/posts.json

```json
[
  {
    "title": "Hello world",
    "slug": "hello-world",
    "date": "1992-02-25T13:22:00.000Z",
    "cover": {
      "src": "/static/cover-2a4138dh.jpg",
      "height": 1100,
      "width": 1650,
      "blurDataURL": "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAACwAQCdASoIAAUADMDOJbACdADWaUXAAMltC0BZxTv24bHUX8EibgVs/sPiTqq6QAA=",
      "blurWidth": 8,
      "blurHeight": 5
    },
    "video": "/static/video-72hhd9f.mp4",
    "metadata": {
      "readingTime": 1,
      "wordCount": 1
    },
    "summary": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse",
    "excerpt": "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse</p>\n<p><img src=\"/static/img-2hd8f3sd.jpg\" alt=\"some image\" /></p>\n<p><a href=\"/static/plain-37d62h1s.txt\">link to file</a></p>\n",
    "content": "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse</p>\n<p><img src=\"/static/img-2hd8f3sd.jpg\" alt=\"some image\" /></p>\n<p><a href=\"/static/plain-37d62h1s.txt\">link to file</a></p>\n",
    "permalink": "/blog/hello-world"
  }
]
```

## Run Velite with Watch Mode

Run `velite` with `--watch` option, then Velite will watch the contents files and rebuild them automatically when they are changed.

::: code-group

```sh [npm]
$ npx velite --watch
```

```sh [pnpm]
$ pnpm velite --watch
```

```sh [yarn]
$ yarn velite --watch
```

```sh [bun]
$ bun velite --watch
```

:::
