---
aside: false
---

# Framework Agnostic

Velite is a framework agnostic library, it can be used in any JavaScript framework or library.

## Try it online

<iframe class="stackblitz" src="https://stackblitz.com/edit/velite-basic?embed=1&view=editor" />

> [!NOTE]
> The sandbox may not always track the latest Velite version. The source below is the source of truth.

## Source code

👉 https://github.com/zce/velite/tree/main/examples/basic

See [examples](https://github.com/zce/velite/tree/main/examples) for more examples.

## Project structure

```text
basic
├── content                  # content directory
│   ├── categories
│   │   ├── journal.webp
│   │   ├── journal.yml
│   │   └── etc...
│   ├── options
│   │   └── index.yml
│   ├── pages
│   │   ├── about
│   │   │   └── index.mdx
│   │   └── contact
|   |       ├── img.png and more...
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
├── .gitignore
├── package.json
├── README.md
└── velite.config.js         # Velite config file
```

## Usage

```shell
$ npm install # install dependencies
$ npm run dev # run build in watch mode
$ npm run build # build content by velite
```

Refer to [Quick Start](../guide/quick-start.md) for more details about Velite.
