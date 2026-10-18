# FAQ

## What is Velite?

Velite turns Markdown / MDX, YAML, JSON, or other files into your app's data layer with type-safe schemas. You describe your content with Zod schemas, run `velite`, and import validated, typed data — no runtime parsing, no untyped `gray-matter` soup.

## How does this relate to Contentlayer?

Velite is heavily inspired by [Contentlayer](https://github.com/contentlayerdev/contentlayer) — the "content as typed data" mental model is theirs. Contentlayer is no longer maintained, and Velite is a fresh implementation rather than a fork: a derivation-graph engine with incremental rebuilds, a Zod 4 schema surface, structured diagnostics instead of log noise, and framework plugins instead of framework coupling.

## Which Node.js version do I need?

Node.js 22.13 or newer. Velite uses recent platform APIs and makes no apologies about it.

## Which frameworks are supported?

Any JavaScript framework or library — the output is plain JSON + ES modules + a `.d.ts`. First-class integrations exist for [Next.js](../guide/with-nextjs.md) (`@velite/plugin-next`) and Vite (`@velite/plugin-vite`); see the runnable [examples](https://github.com/zce/velite/tree/main/examples).

## Why build-time instead of importing MDX at runtime?

Runtime imports mean every page render pays for parsing, plugin pipelines, and validation — and your data's types are whatever the MDX pipeline happens to produce. Velite does all of that once at build time, validates every record against a schema, and emits plain data plus a generated `.d.ts`. Your app imports data, not a content pipeline.

## How are images and linked files handled?

Relative references in frontmatter (`s.image()`, `s.file()`) and inside Markdown/MDX bodies (`copyLinkedFiles`) are copied into the assets output directory with content-hashed filenames, and every URL is rewritten to its public URL. `s.image()` additionally probes dimensions and generates a blur placeholder. Absolute paths resolve only when you pass `absoluteRoot`; remote URLs are not fetched — use a custom schema for those.

## What is the `.velite` directory?

The generated data layer: per-record JSON (or per-collection JSON in production), collection modules, `index.js`, `index.d.ts`, and an internal manifest used for incremental writes. It is build output — add it to `.gitignore`.

## Can I write custom schemas and loaders?

Yes. Custom schemas are ordinary Zod schemas; `context()` gives them the current file, record, and project during parsing, plus asset resolution and effect declaration (see [Custom Schema](../guide/custom-schema.md)). Custom loaders describe a `match` + synchronous `load` contract (see [Custom Loader](../guide/custom-loader.md)) — note that custom loader registration from the config file is not available yet; it is on the [roadmap](roadmap.md).

## Why did my build fail with `ASSET_FAILED`?

A schema referenced a file that could not be read — usually a typo'd relative path, a missing file, or an absolute path without `absoluteRoot`. The diagnostic names the exact path; fix the reference or add the file.

## What is strict mode?

By default, schema-level errors are reported as diagnostics and the build still produces output for the valid records. `--strict` (CLI) or `strict: true` (Node API) makes any error-level diagnostic fail the build with a `VeliteError` instead — useful in CI.

## How does incremental build work?

The build is a graph of memoized derivations (sources → load → validate → collect → emit, plus per-asset derivations). In watch mode, a file event patches exactly the affected inputs and only the derivations that transitively depend on them recompute. Changing one post re-validates one source file, not the project.

## Is it production ready?

Velite's 1.0 architecture (incremental engine, diagnostics, plugins) is settled and covered by 600+ tests. Check the version you are installing and read the [migration notes](../guide/migration.md) — the guide tells you what changed between releases and what to update when upgrading.
