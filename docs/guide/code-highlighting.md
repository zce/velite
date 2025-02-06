# Code Highlighting

Velite doesn't include built-in code highlighting features because not all content contains code, and that syntax highlighting often comes with custom styles. But you can easily implement it yourself with build-time plugins or client-side highlighters.

::: tip

Code highlighting in Build-time is recommended, because it is faster and more stable.

:::

## @shikijs/rehype

> [shiki](https://shiki.style) is a beautiful syntax highlighter for code blocks.

::: code-group

```sh [npm]
$ npm install @shikijs/rehype shiki
```

```sh [pnpm]
$ pnpm add @shikijs/rehype shiki
```

```sh [yarn]
$ yarn add @shikijs/rehype shiki
```

:::

In your `velite.config.ts`:

```ts
import rehypeShiki from '@shikijs/rehype'
import { defineConfig } from 'velite'

export default defineConfig({
  // `mdx` if you use mdx
  markdown: {
    rehypePlugins: [
      [
        rehypeShiki as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { theme: 'one-dark-pro' }
      ]
    ]
  }
})
```

### Transformers

Shiki provides a `transformers` option to customize the output of the syntax highlighting. You can use it to add line highlighting, line numbers, etc.

::: code-group

```sh [npm]
$ npm install @shikijs/transformers
```

```sh [pnpm]
$ pnpm add @shikijs/transformers
```

```sh [yarn]
$ yarn add @shikijs/transformers
```

:::

```ts
import rehypeShiki from '@shikijs/rehype'
import { transformerNotationDiff, transformerNotationErrorLevel, transformerNotationFocus, transformerNotationHighlight } from '@shikijs/transformers'
import { defineConfig } from 'velite'

export default defineConfig({
  // `mdx` if you use mdx
  markdown: {
    rehypePlugins: [
      [
        rehypeShiki as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          transformers: [
            transformerNotationDiff({ matchAlgorithm: 'v3' }),
            transformerNotationHighlight({ matchAlgorithm: 'v3' }),
            transformerNotationFocus({ matchAlgorithm: 'v3' }),
            transformerNotationErrorLevel({ matchAlgorithm: 'v3' })
          ]
        }
      ]
    ]
  }
})
```

### Copy button

Shiki doesn't provide a copy button by default, but you can add one with a build-time plugin.

```ts
import rehypeShiki from '@shikijs/rehype'
import { defineConfig } from 'velite'

const transformerCopyButton = (): ShikiTransformer => ({
  name: 'copy-button',
  pre(node) {
    node.children.push({
      type: 'element',
      tagName: 'button',
      properties: {
        type: 'button',
        className: 'copy',
        title: 'Copy to clipboard',
        onclick: `
          navigator.clipboard.writeText(this.previousSibling.textContent),
          this.className='copied',
          this.title='Copied!',
          setTimeout(()=>this.className='copy',5000)`.replace(/\s+/g, '')
      },
      children: [
        {
          type: 'element',
          tagName: 'svg',
          properties: {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '1.5',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          },
          children: [
            {
              type: 'element',
              tagName: 'rect',
              properties: {
                width: '8',
                height: '4',
                x: '8',
                y: '2',
                rx: '1',
                ry: '1'
              },
              children: []
            },
            {
              type: 'element',
              tagName: 'path',
              properties: {
                d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'
              },
              children: []
            },
            {
              type: 'element',
              tagName: 'path',
              properties: {
                class: 'check',
                d: 'm9 14 2 2 4-4'
              },
              children: []
            }
          ]
        }
      ]
    })
  }
})

export default defineConfig({
  // `mdx` if you use mdx
  markdown: {
    rehypePlugins: [
      [
        rehypeShiki as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          transformers: [transformerCopyButton()]
        }
      ]
    ]
  }
})
```

```css
pre.shiki {
  @apply max-h-(--max-height,80svh) relative flex flex-col overflow-hidden p-0;

  code {
    @apply block size-full overflow-auto py-5;
  }

  button {
    @apply hover:opacity-100! absolute right-3 top-3 flex cursor-pointer select-none items-center justify-center rounded-md bg-slate-600 text-sm font-medium text-white opacity-0 shadow outline-0 transition;

    svg {
      @apply m-2 size-5;
    }

    .check {
      @apply opacity-0 transition-opacity;
    }

    &.copied {
      @apply opacity-100!;

      &::before {
        @apply border-r border-[#0002] p-2 px-2.5 content-['Copied!'];
      }

      .check {
        @apply opacity-100;
      }
    }
  }

  &:hover {
    button {
      @apply opacity-80;
    }
  }
}
```

If you want to add more useful transformers, you can refer to the [shiki transformers](https://shiki.style/guide/transformers) documentation.

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
  // `mdx` if you use mdx
  markdown: {
    rehypePlugins: [rehypePrettyCode]
  }
})
```

`rehype-pretty-code` creates the proper HTML structure for syntax highlighting, you can then add styles however you like. Here is an example stylesheet:

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

Refer to [examples](https://github.com/zce/velite/blob/main/examples/nextjs/velite.config.ts) for more details.

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
  // `mdx` if you use mdx
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

  markdown: {// `mdx` if you use mdx
export default defineConfig({
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
  // `mdx` if you use mdx
  markdown: {
    rehypePlugins: [rehypeHighlight]
  }
})
```

## Client-side

You can use [prismjs](https://prismjs.com) or [shiki](https://shiki.matsu.io) to highlight code on the client side. Client-side highlighting does not add build overhead to Velite.

For example:

```js
import { codeToHtml } from 'https://esm.sh/shikiji'

Array.from(document.querySelectorAll('pre code[class*="language-"]')).map(async block => {
  block.parentElement.outerHTML = await codeToHtml(block.textContent, { lang: block.className.slice(9), theme: 'nord' })
})
```

::: tip

If you have a large of number of documents that need to be syntax highlighted, it is recommended to use the client-side method. Because syntax highlighting and parsing can be very time-consuming, and it will greatly affect the construction speed of Velite.

:::
