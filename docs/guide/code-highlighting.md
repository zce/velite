# Code Highlighter

Considering that not all content contains code, and that syntax highlighting often comes with custom styles, Velite doesn't want to subjectively determine the final presentation of your content. So we don't include built-in code highlighting features.

If you think code highlighting is necessary for your content, you can implement if by referring to the following methods.

## rehype-shikiji

> [Shikiji](https://github.com/antfu/shikiji) is a improved version of [Shiki](https://shiki.matsu.io)

::: code-group

```sh [npm]
$ npm install rehype-shikiji
```

```sh [pnpm]
$ pnpm add rehype-shikiji
```

```sh [yarn]
$ yarn add rehype-shikiji
```

:::

In your `velite.config.js`:

```js
import rehypeShikiji from 'rehype-shikiji'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    rehypePlugins: [[rehypeShikiji, { theme: 'nord' }]]
  }
})
```

::: tip

Velite packages most types of third-party modules, this leads to incompatible type declarations for `rehype-shikiji`, but you can use it with confidence

In your `velite.config.ts`:

```js
import rehypeShikiji from 'rehype-shikiji'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    rehypePlugins: [[rehypeShikiji as any, { theme: 'nord' }]]
  }
})
```

:::

## rehype-highlight

> syntax highlighting to code with [lowlight][https://github.com/wooorm/lowlight].

::: code-group

```sh [npm]
$ npm install rehype-highlight
```

```sh [pnpm]
$ pnpm add rehype-highlight
```

```sh [yarn]
$ yarn add rehype-highlight
```

:::

In your `velite.config.js`:

```js
import rehypeHighlight from 'rehype-highlight'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeHighlight]
  }
})
```

## Client-side

Code highlighting in Client-side. You can use [prismjs](https://prismjs.com) or [shiki](https://shiki.matsu.io) to highlight code in client-side.
