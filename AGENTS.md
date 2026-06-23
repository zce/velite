# AGENTS.md

Velite — a tool that turns Markdown / MDX, YAML, JSON into a type-safe data layer using Zod schemas.

## Quick reference

| What                        | Command         |
| --------------------------- | --------------- |
| Install deps                | `pnpm install`  |
| Build (type-check + bundle) | `pnpm build`    |
| Run tests                   | `pnpm test`     |
| Format code                 | `pnpm format`   |
| Dev docs site               | `pnpm docs:dev` |

**Required order for verification:** `pnpm build` → `pnpm test` (tests run against built `dist/`).

## Architecture

- **Monorepo** managed by pnpm workspaces: root package, `docs/`, `examples/*`, `packages/*`
- Root package is the core library (`velite` on npm)
- `packages/next` → `@velite/plugin-next` (Next.js integration, hand-written JS)
- `packages/vite` → `@velite/plugin-vite` (Vite integration, hand-written JS)
- ESM-only (`"type": "module"`), Node.js >=22.13.0

## Source layout (`src/`)

| File           | Role                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public API entry and barrel, including public helpers/types plus the public `build()` facade                                                                                 |
| `cli.ts`       | CLI entry (`velite build` / `velite dev`)                                                                                                                                    |
| `app/`         | Application orchestration: `Engine`, watch controller, and build options                                                                                                     |
| `core/`        | Core models: `errors`, `ids`, `session`, `graph`, `cache`, `snapshot`, `project`, `pipeline`                                                                                 |
| `config/`      | Public config types/helper plus runtime config loading (via jiti)                                                                                                            |
| `collections/` | Public collection types/helper plus discovery, file loading, and file cache                                                                                                  |
| `output/`      | Public output type plus output planning (single/split layout), writing, and emit cache                                                                                       |
| `assets/`      | Asset store, asset path processing, image metadata, and Markdown/MDX linked-file plugins                                                                                     |
| `runtime/`     | Logger                                                                                                                                                                       |
| `loaders/`     | Built-in loaders: `json`, `yaml`, `matter` (frontmatter)                                                                                                                     |
| `schemas/`     | Schema namespace (`s`), context, effects, and built-in schemas: `file`, `image`, `markdown`, `mdx`, `slug`, `toc`, `excerpt`, `metadata`, `path`, `raw`, `isoDate`, `unique` |

## Key patterns

- `s` is the extended Zod namespace (`src/schemas/index.ts`) — re-exports all of `zod` plus custom schemas
- User config files (`velite.config.{js,ts,mjs,mts,cjs,cts}`) are loaded with **jiti** at runtime (`src/config/load.ts`), not bundled with esbuild
- Config is searched up to 3 parent directories from cwd (`src/config/load.ts`)
- Default content root: `content/`, default output: `.velite/` (data) + `public/static/` (assets)
- `defineConfig`, `defineCollection`, `defineLoader` are identity helpers for type inference only
- The `prepare` hook can return `false` to suppress default file output
- Tests use Node's built-in test runner (`node:test`) with `jiti/register` as the TS loader
- Bundled with **tsdown** (rolldown/Rust), not tsup (esbuild)
- All build-scoped mutable state lives on `Session` (`src/core/session.ts`) and its `SessionStore`; independent builds are isolated by construction
- Schema cross-file state uses the effects model (collect → validate → commit), not direct mutation
- `context()` returns the full schema context (project, file, record, store, assetCache, assetStore, collectEffect) — built-in and user schemas have the same capability boundary

## Module organization

- For source architecture changes, read `.agents/knowledge/architecture.md`, `.agents/knowledge/module-pattern.md`, and `.agents/knowledge/anti-patterns.md` first.
- Dependency-bearing modules, stateful modules, lifecycle-managed modules, runtime adapters, and composition modules must use explicit factory DI. Dependencies must be visible, typed, and wired at a composition root.
- Do not introduce IoC containers, service locators, decorator injection, runtime auto-registration, or hidden singleton services unless explicitly requested.
- Do not force factory wrappers onto pure functions, type-only modules, constants, error classes, schema builders, identity helpers, or public facade functions unless they gain external dependencies, lifecycle state, or a replaceable capability boundary.

## Code style

- Prettier: no semicolons, single quotes, no trailing commas, 160 char width
- Import sorting via `@ianvs/prettier-plugin-sort-imports` (configured in `prettier.config.js`)
- Pre-commit hook: `simple-git-hooks` → `lint-staged` → `prettier --write`

## Testing

```bash
pnpm test   # runs: node --import jiti/register --test test/**/*.tests.ts
```

- Tests in `test/` use `node:test` + `node:assert`
- Tests run against the **built** output (`dist/`), so `pnpm build` must run first
- `test/integration/basic.tests.ts` builds the `examples/basic` fixture and checks generated output content
- Tests clean up `.velite` output dirs after running

## Gotchas

- The package bin points to `dist/cli.mjs`; `tsdown` injects the Node shebang during build
- `jiti` is a runtime dependency (config loading), not bundled into dist
- `sharp`, `@mdx-js/mdx`, `terser`, `zod` are runtime dependencies (external)
- All other runtime tools (`chokidar`, `picomatch`, `tinyglobby`, `yaml`, `unified`, etc.) are devDependencies bundled into dist
- Config loading uses `jiti` with `alias: { velite: dist/index.mjs }` for self-reference
- When adding runtime imports, put public API/native/heavy/override-sensitive deps in `dependencies`; put pure internal implementation tools in `devDependencies` so they are bundled
- After changing dependency groups, run `pnpm build` and check `dist/` for unexpected bare imports
- `sharp` is an allowed native build in `pnpm-workspace.yaml`
- Internal modules are exposed through `src/index.ts` only when intentionally public; do not re-export implementation folders wholesale

## Session workspace

- **Plans, intermediate notes, per-task reports** go under `.agents/sessions/YYYYMMDD-HHmm-{slug}/`.
- **Save plans to:** `.agents/sessions/YYYYMMDD-HHmm-{slug}/plan.md` instead of the plugin or skill presets.
- **Save specs to:** `.agents/sessions/YYYYMMDD-HHmm-{slug}/specs.md` instead of the plugin or skill presets.
- Session subfolders are gitignored by default — never put long-lived conventions there; promote them to `.agents/knowledge/` instead.
- Full rules: `.agents/AGENTS.md`

## Subdirectory AGENTS.md

Load a subdirectory's `AGENTS.md` when you are about to work primarily in that directory:

| When working in                           | Load                 |
| ----------------------------------------- | -------------------- |
| `packages/next` or `packages/vite`        | `packages/AGENTS.md` |
| Planning, research, or session management | `.agents/AGENTS.md`  |

Skip if you are only passing through (e.g. a quick grep or single-file read).
