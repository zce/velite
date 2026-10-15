---
aside: false
---

# With Next.js

Velite loves [Next.js](https://nextjs.org/), it's a great framework for building full-stack web applications.

> [!TIP] Some examples that may help you:
>
> - [zce/taxonomy](https://github.com/zce/taxonomy) - A fork of [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) using Velite.

This example shows how to use Velite with Next.js.

## Try it online

<iframe class="stackblitz" src="https://stackblitz.com/edit/velite-nextjs?embed=1&view=editor" />

## Source code

👉 https://stackblitz.com/github/zce/velite/tree/main/examples/nextjs

See [examples](https://github.com/zce/velite/tree/main/examples) for more examples.

## Project structure

```text
nextjs
├── app                      # Next.js app directory
│   ├── layout.tsx
│   ├── page.tsx
│   └── etc...
├── components
│   ├── mdx-content.tsx
│   └── etc...
├── content                  # content directory
│   ├── categories
│   │   ├── journal.jpg
│   │   ├── journal.yml
│   │   └── etc...
│   ├── options
│   │   └── index.yml
│   ├── pages
│   │   ├── about
│   │   │   └── index.mdx
│   │   └── contact
│   │       ├── img.png and more...
│   │       └── index.mdx
│   ├── posts
│   │   ├── 1970-01-01-style-guide
│   │   │   ├── cover.jpg and more...
│   │   │   └── index.md
│   │   └── 2024-05-08-hello-world
│   │       ├── cover.jpg and more...
│   │       └── index.md
│   └── tags
│       └── index.yml
├── public                   # public directory
│   ├── favicon.ico
│   └── etc...
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
└── velite.config.ts         # Velite config file
```

## Usage

```shell
$ npm install # install dependencies
$ npm run dev # run build in watch mode
$ npm run build # build content by velite
```

Refer to [Integration with Next.js](../guide/with-nextjs.md) for more details about Velite with Next.js.
