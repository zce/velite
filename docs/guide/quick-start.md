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

## Define Contents Schema

Create a `velite.config.js` file in the root directory of your project:

```js
import { defineConfig, s } from 'velite'

// s is extended from zod with some custom schemas

export default defineConfig({
  collections: {
    posts: {
      name: 'Post',
      pattern: 'posts/**/*.md',
      schema: s
        .object({
          title: s.string().max(99),
          slug: s.slug('posts'),
          date: s.isodate(),
          cover: s.image().optional(),
          video: s.file().optional(),
          metadata: s.metadata(),
          summary: s.summary(),
          excerpt: s.excerpt(),
          content: s.markdown()
        })
        .transform(data => ({ ...data, permalink: `/blog/${data.slug}` }))
    },
    others: {
      // ...
    }
  }
})
```

::: tip
Config file supports TypeScript & ESM, so you can use the full power of TypeScript to write your config file.
:::

## Create Contents Files

Add your creative content to the `content` directory, like this:

```diff
 root
+├── content
+│   ├── posts
+│   │   ├── hello-world.md
+│   │   └── hello-world-2.md
+│   └── others
+│       └── other.yml
 ├── public
 ├── package.json
 └── velite.config.js
```

## Build Contents by Velite

Run the following command:

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
+│       └── img-2hd83d.jpg # from content reference
 ├── package.json
 └── velite.config.js
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
