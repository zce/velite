# Code Highlighting

Considering that not all content contains code, and that syntax highlighting often comes with custom styles, Velite doesn't want to subjectively determine the final presentation of your content. So we don't include built-in code highlighting features.

If you think code highlighting is necessary for your content, you can implement if by referring to the following methods.

## rehype-pretty-code

> [rehype-pretty-code](https://rehype-pretty-code.netlify.app) is a rehype plugin to format code blocks.

::: code-group

```sh [npm]
$ npm install rehype-pretty-code shiki
```

```sh [pnpm]
$ pnpm add rehype-pretty-code shiki
```

```sh [yarn]
$ yarn add rehype-pretty-code shiki
```

:::

In your `velite.config.js`:

```js
import rehypePrettyCode from 'rehype-pretty-code'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    // https://rehype-pretty-code.netlify.app/
    rehypePlugins: [rehypePrettyCode]
  }
})
```

Add some necessary styles, such as:

```css
[data-rehype-pretty-code-figure] pre {
  @apply px-0;
}

[data-rehype-pretty-code-figure] code {
  @apply text-sm !leading-loose md:text-base;
}

[data-rehype-pretty-code-figure] code[data-line-numbers] {
  counter-reset: line;
}

[data-rehype-pretty-code-figure] code[data-line-numbers] > [data-line]::before {
  counter-increment: line;
  content: counter(line);
  @apply mr-4 inline-block w-4 text-right text-gray-500;
}

[data-rehype-pretty-code-figure] [data-line] {
  @apply border-l-2 border-l-transparent px-3;
}

[data-rehype-pretty-code-figure] [data-highlighted-line] {
  background: rgba(200, 200, 255, 0.1);
  @apply border-l-blue-400;
}

[data-rehype-pretty-code-figure] [data-highlighted-chars] {
  @apply rounded bg-zinc-600/50;
  box-shadow: 0 0 0 4px rgb(82 82 91 / 0.5);
}

[data-rehype-pretty-code-figure] [data-chars-id] {
  @apply border-b-2 p-1 shadow-none;
}
```

refer to [examples](https://github.com/zce/velite/blob/main/examples/nextjs/velite.config.ts) for more details.

## @shikijs/rehype

::: code-group

```sh [npm]
$ npm install @shikijs/rehype
```

```sh [pnpm]
$ pnpm add @shikijs/rehype
```

```sh [yarn]
$ yarn add @shikijs/rehype
```

:::

In your `velite.config.js`:

```js
import rehypeShiki from '@shikijs/rehype'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    rehypePlugins: [[rehypeShiki, { theme: 'nord' }]]
  }
})
```

::: tip

Velite packages most types of third-party modules, this leads to incompatible type declarations for `@shikijs/rehype`, but you can use it with confidence

In your `velite.config.ts`:

```js
import rehypeShiki from '@shikijs/rehype'
import { defineConfig } from 'velite'

export default defineConfig({
  markdown: {
    rehypePlugins: [[rehypeShiki as any, { theme: 'nord' }]]
  }
})
```

:::

## rehype-highlight

> syntax highlighting to code with [lowlight](https://github.com/wooorm/lowlight).

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

for example:

```js
import { codeToHtml } from 'https://esm.sh/shikiji'

Array.from(document.querySelectorAll('pre code[class*="language-"]')).map(async block => {
  block.parentElement.outerHTML = await codeToHtml(block.textContent, { lang: block.className.slice(9), theme: 'nord' })
})
```

::: tip

This method is most recommended if there are a large number of documents that need to be processed frequently. Because syntax highlighting and parsing is very time-consuming, it will greatly affect the construction speed of Velite.

:::
