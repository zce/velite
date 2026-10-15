# Motivation

## Content should be data

Modern apps already treat Markdown files, YAML config, and JSON as a de-facto database — queried, joined, and rendered. But the tooling treats them as strings: `fs.readFile`, a frontmatter parser, and a prayer. Every consumer re-implements loading, validation, and typing, and the result is untyped `any` soup flowing into components.

Velite's position is simple: **content is a data layer, so it deserves what a data layer gets** — a schema, validation, typed queries, and a build step that enforces all three.

## Type safety, all the way down

Zod already won the "describe your data once" argument. Velite applies it to content: the same schema that validates a Markdown file's frontmatter also produces the TypeScript type of its output. A typo in a frontmatter date is a build diagnostic with the file and field, not a runtime `undefined` three pages deep.

## Build time, not request time

Parsing Markdown, running remark/rehype pipelines, probing images, and hashing assets are expensive. Doing them per request is a tax on every visitor; doing them per import is a tax on every dev. Velite does them once, at build time, and hands the app plain JSON plus a generated `.d.ts` — the app never loads a content pipeline.

## Framework agnostic on purpose

Content outlives frameworks. The output being plain JSON + ES modules + types (instead of a framework-specific store) is what lets the same `content/` directory serve a Next.js app today and something else next year, with [plugins](https://github.com/zce/velite/tree/main/packages) covering the integration glue per framework.

## Standing on Contentlayer's shoulders

[Contentlayer](https://github.com/contentlayerdev/contentlayer) proved the model and then stopped maintaining it. Velite is a fresh implementation of the same idea — not a fork — keeping the "content as typed data" contract while rebuilding the machinery: an incremental derivation engine, structured diagnostics instead of log noise, and watch-mode rebuilds that touch one file's work, not the project's.
