---
aside: false
---

# Framework Agnostic

Velite is a framework agnostic library, it can be used in any JavaScript framework or library.

## Try it online

<iframe class="stackblitz" src="https://stackblitz.com/edit/velite-basic?embed=1&view=editor" />

## Source code

👉 https://stackblitz.com/github/zce/velite/tree/main/examples/nextjs

See [examples](https://github.com/zce/velite/tree/main/examples) for more examples.

## Project structure

```text
basic
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
|   |       ├── img.png and more...
│   │       └── index.mdx
│   ├── posts
│   │   ├── 1970-01-01-style-guide
│   │   │   ├── cover.jpg and more...
│   │   │   └── index.md
│   │   └── 1992-02-25-hello-world
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
$ npm run dev # run build with watch mode
$ npm run build # build content by velite
```

Refer to [Quick Start](../guide/quick-start.md) for more details about Velite.
