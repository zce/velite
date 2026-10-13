# How Velite Works

![Velite Workflow](/assets/flow-dark.svg#dark 'Velite Workflow')
![Velite Workflow](/assets/flow.svg#light 'Velite Workflow')

A velite build is a pipeline of small, memoized steps. This page walks through them once, top to bottom, so you can reason about what a build touches, what lands on disk, and what watch mode reuses.

## 1. Config resolution

Velite searches for `velite.config.{js,ts,mjs,mts,cjs,cts}` from the working directory (up to 3 parent directories), then loads it with [jiti](https://github.com/unjs/jiti) at runtime — TypeScript, ESM, and CommonJS configs all work without a pre-compilation step. Any extra local files the config imports while evaluating are tracked as **config dependencies**: in watch mode, changing any of them triggers a full session reload instead of an incremental rebuild.

## 2. Discovery

The build walks the content `root` (default `content/`) into a file tree, then each collection's `pattern` (with `exclude` / `!negation` globs) selects its sources from that tree. Discovery is a pure function of the tree snapshot — the tree is an engine input, and changing it is what invalidates discovery.

## 3. Load

Each source file is parsed by the first loader matching its extension:

- `matter` (`.md`, `.mdx`) — YAML frontmatter + body
- `json` (`.json`) — a top-level array yields one item per element
- `yaml` (`.yaml`, `.yml`) — a top-level sequence yields one item per element

The output is a list of raw items (key + unvalidated data). A file with broken syntax produces a `LOADER_FAILED` diagnostic, not a crash.

## 4. Validate

Every raw item is validated against the collection's schema (a [Zod](https://zod.dev) schema, usually `s.object({...})`). This is where the interesting parts happen:

- **Schema context** — while a record is being parsed, custom and built-in schemas can call `context()` to read the current file, record, and project, demand asset resolution, or declare effects.
- **Content Definitions** — `content.markdown()` / `content.mdx()` definitions execute the Markdown/MDX pipeline per record, memoized per (definition, input text) so `html()`, `toc()`, `excerpt()`, and `metadata()` from one definition share the work.
- **Effects** — schemas never mutate shared state mid-parse. `s.unique()` / `s.slug()` register uniqueness claims; `s.file()` / `s.image()` register asset references. Effects are collected per record and only promoted if the record validates.

Schema-level validation failures are **non-fatal**: the offending record is dropped from the output and a diagnostic is recorded, but the build continues so you see all errors at once.

## 5. Emit

The emit step aggregates every collection and applies the cross-record decisions that per-record validation deliberately cannot make:

- **Uniqueness scan** — two live records registering the same `(group, value)` each get an error diagnostic and are dropped.
- **Singleton cardinality** — a `single: true` collection with zero or multiple entries gets a diagnostic; exactly the first entry survives.

The result is the **logical output**: the validated, ordered, post-decision shape of every collection, before any files exist.

## 6. Two-pass asset flow

Assets (referenced files and images) are resolved in two passes:

1. Pass 1 runs the schemas; asset references produce placeholder public urls (the url is derivable from the source path, but the content hash needs bytes). The driver then reads the referenced files' bytes and feeds them into the engine.
2. Pass 2 re-runs the affected derivations with real bytes: urls become content-hashed (`cover-4c68cc74.jpg`), images are probed for dimensions, and blur placeholders are generated.

A referenced file that cannot be read produces a fatal `ASSET_FAILED` diagnostic — the build fails rather than emitting dead links.

## 7. Prepare hook

Between emit and any write, the user-facing `prepare` hook sees a friendly view of the collections. It may mutate records in place, replace the collections, or return `false` to suppress all default output (e.g. when uploading data elsewhere). The only way to add diagnostics from the hook is `context.addDiagnostic`.

## 8. Write

The writer turns the logical output into physical files:

- **Split layout** (the default outside production): one JSON file per record at stable identity-based paths (`records/<collection>/<stem>.<id>.json`), one ES module per collection, plus `index.js` and `index.d.ts`.
- **Single layout** (production / `layout: 'single'`): one JSON file per collection.

Writes are hash-compared against a manifest of the previous run — unchanged files are skipped, files that are no longer part of the plan are deleted, and orphaned hashed assets from earlier builds are reconciled away. The public import surface (`import { posts } from './.velite'`) is identical in both layouts.

## 9. Watch mode

In watch mode, file events are classified as **config** (full reload), **content** (incremental), or **ignore** (output dirs, unrelated paths). A content event patches exactly the affected engine inputs — one file's bytes, one asset's bytes, or the tree — and the memoized derivation graph recomputes only what actually depended on them. This is why changing one Markdown file re-validates one source, not the whole project.
