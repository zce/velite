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
- ESM-only (`"type": "module"`), Node.js >=20.19.0

## Source layout (`src/`)

| File         | Role                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`   | Public API barrel export                                                                                                            |
| `cli.ts`     | CLI entry (`velite build` / `velite dev`)                                                                                           |
| `build.ts`   | Core build orchestration, watch mode                                                                                                |
| `config.ts`  | Config resolution (bundles user config via esbuild)                                                                                 |
| `context.ts` | Schema parsing with Zod context                                                                                                     |
| `file.ts`    | `VeliteFile` — file loading and record extraction                                                                                   |
| `output.ts`  | Data/asset output, `.d.ts` generation                                                                                               |
| `assets.ts`  | Asset tracking and deduplication                                                                                                    |
| `state.ts`   | Global build state                                                                                                                  |
| `logger.ts`  | Logging with levels                                                                                                                 |
| `types.ts`   | All TypeScript interfaces (`Config`, `UserConfig`, `Collection`, etc.)                                                              |
| `utils.ts`   | Pattern matching utilities                                                                                                          |
| `loaders/`   | Built-in loaders: `json`, `yaml`, `matter` (frontmatter)                                                                            |
| `schemas/`   | Custom Zod extensions: `file`, `image`, `markdown`, `mdx`, `slug`, `toc`, `excerpt`, `metadata`, `path`, `raw`, `isodate`, `unique` |

## Key patterns

- `s` is the extended Zod namespace (`src/schemas/index.ts:16`) — re-exports all of `zod` plus custom schemas
- User config files (`velite.config.{js,ts,mjs,mts,cjs,cts}`) are bundled with esbuild at runtime, not imported directly (`src/config.ts:69`)
- Config is searched up to 3 parent directories from cwd (`src/config.ts:21`)
- Default content root: `content/`, default output: `.velite/` (data) + `public/static/` (assets)
- `defineConfig`, `defineCollection`, `defineLoader`, `defineSchema` are identity helpers for type inference only
- The `prepare` hook can return `false` to suppress default file output
- Tests use Node's built-in test runner (`node:test`), not Jest/Vitest

## Code style

- Prettier: no semicolons, single quotes, no trailing commas, 160 char width
- Import sorting via `@ianvs/prettier-plugin-sort-imports` (configured in `prettier.config.js`)
- Pre-commit hook: `simple-git-hooks` → `lint-staged` → `prettier --write`

## Testing

```bash
pnpm test   # runs: node --import tsx --test test/*.ts
```

- Tests in `test/` use `node:test` + `node:assert`
- Tests run against the **built** output (`dist/`), so `pnpm build` must run first
- `test/basic.ts` builds the `examples/basic` fixture and checks output file sizes
- Tests clean up `.velite` output dirs after running

## Gotchas

- `bin/velite.js` imports `../dist/cli.js` — you must build before running the CLI from source
- The `tsup` config injects a `require` shim banner for CJS interop in the ESM output
- `sharp` and `esbuild` are allowed native builds in `pnpm-workspace.yaml`
- Config bundling uses `packages: 'external'` — user deps are not bundled into config output
- The `unique` schema (`src/schemas/unique.ts`) uses a global cache that must be reset between builds (`clearBuildState` in `build.ts:23`)

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
