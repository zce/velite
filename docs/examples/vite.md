---
aside: false
---

# With Vite

Velite is framework agnostic, and [`@velite/plugin-vite`](https://github.com/zce/velite/tree/main/packages/vite) makes it a one-liner in Vite.

## Source code

👉 https://github.com/zce/velite/tree/main/examples/vite

See [examples](https://github.com/zce/velite/tree/main/examples) for more examples.

## Project structure

```text
vite
├── src                       # application source
│   ├── App.tsx
│   ├── main.tsx
│   └── etc...
├── content                   # content directory
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
├── public                    # static directory (velite assets output)
│   └── static
│       └── etc...
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts            # Vite config file
└── velite.config.ts          # Velite config file
```

## Usage

```shell
$ npm install # install dependencies
$ npm run dev # start Vite dev server (velite watches in background)
$ npm run build # build the app (velite runs first)
```

Refer to the [`@velite/plugin-vite` readme](https://github.com/zce/velite/tree/main/packages/vite) for more details about the plugin.
