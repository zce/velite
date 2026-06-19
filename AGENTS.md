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

| File           | Role                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public API entry and barrel, including public helpers/types plus the public `build()` facade                                        |
| `cli.ts`       | CLI entry (`velite build` / `velite dev`)                                                                                           |
| `app/`         | Application orchestration: `Engine`, watch controller, and build options                                                            |
| `config/`      | Public config types/helper plus runtime config loading/bundling                                                                     |
| `collections/` | Public collection types/helper plus discovery, resolving, `VeliteFile`, and file cache                                              |
| `output/`      | Public output type plus generated entry/data/assets writing and emit cache                                                          |
| `assets/`      | Asset store, asset path processing, image metadata, and Markdown/MDX linked-file plugins                                            |
| `runtime/`     | Schema parsing context, session store, build session, and logger                                                                    |
| `loaders/`     | Built-in loaders: `json`, `yaml`, `matter` (frontmatter)                                                                            |
| `schemas/`     | Custom Zod extensions: `file`, `image`, `markdown`, `mdx`, `slug`, `toc`, `excerpt`, `metadata`, `path`, `raw`, `isodate`, `unique` |
| `utils/`       | Small shared utilities such as pattern matching                                                                                     |

## Key patterns

- `s` is the extended Zod namespace (`src/schemas/index.ts:16`) — re-exports all of `zod` plus custom schemas
- User config files (`velite.config.{js,ts,mjs,mts,cjs,cts}`) are bundled with esbuild at runtime, not imported directly (`src/config/load.ts`)
- Config is searched up to 3 parent directories from cwd (`src/config/load.ts`)
- Default content root: `content/`, default output: `.velite/` (data) + `public/static/` (assets)
- `defineConfig`, `defineCollection`, `defineLoader`, `defineSchema` are identity helpers for type inference only
- The `prepare` hook can return `false` to suppress default file output
- Tests use Node's built-in test runner (`node:test`), not Jest/Vitest
- All build-scoped mutable state lives on `BuildSession` (`src/runtime/session.ts`) and its `SessionStore`; independent builds are isolated by construction

## Code style

- Prettier: no semicolons, single quotes, no trailing commas, 160 char width
- Import sorting via `@ianvs/prettier-plugin-sort-imports` (configured in `prettier.config.js`)
- Pre-commit hook: `simple-git-hooks` → `lint-staged` → `prettier --write`

## Testing

```bash
pnpm test   # runs: node --import tsx --test test/**/*.tests.ts
```

- Tests in `test/` use `node:test` + `node:assert`
- Tests run against the **built** output (`dist/`), so `pnpm build` must run first
- `test/basic.ts` builds the `examples/basic` fixture and checks generated output content
- Tests clean up `.velite` output dirs after running

## Gotchas

- The package bin points to `dist/cli.js`; `tsup` injects the Node shebang during build
- The `tsup` config injects a `require` shim banner for CJS interop in the ESM output
- Bundling strategy intentionally follows tsup defaults: `dependencies` stay external, while runtime internals listed only in `devDependencies` are bundled into `dist/`
- When adding runtime imports, put public API/native/heavy/override-sensitive deps in `dependencies`; put pure internal implementation tools in `devDependencies` so they are bundled
- After changing dependency groups, run `pnpm build` and check `dist/` for unexpected bare imports
- `sharp` and `esbuild` are allowed native builds in `pnpm-workspace.yaml`
- Config bundling uses `packages: 'external'` — user deps are not bundled into config output
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
