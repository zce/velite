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

**Verification:** `pnpm test` — it runs `pnpm build` first, then the suites against built `dist/`.

## Architecture

- **Monorepo** managed by pnpm workspaces: root package, `docs/`, `examples/*`, `packages/*`
- Root package is the core library (`velite` on npm)
- `packages/next` → `@velite/plugin-next` (Next.js integration, hand-written JS)
- `packages/vite` → `@velite/plugin-vite` (Vite integration, hand-written JS)
- ESM-only (`"type": "module"`), Node.js >=22.13.0

## Source layout (`src/`)

The core library is runtime-agnostic; all I/O and platform APIs live behind ports in `src/runtime/`, adapted per platform.

| Path                     | Role                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`               | Public API barrel + `build()`/`watch()`/`builder()` facades (wires default Node adapters via DI)                                                                                 |
| `cli.ts`                 | CLI entry (`velite build` / `velite dev`); delegates to the public facades                                                                                                       |
| `core/assets.ts`         | Shared asset identity + naming contract — the neutral seam between `s.file`/`s.image`, content execution, the driver, and `pipeline/asset.ts`                                    |
| `core/builder.ts`        | **Composition root** — `createBuilder(deps)` assembles config + loaders + pipeline + engine + driver into a `Builder`; owns watch state + mutex                                  |
| `core/config.ts`         | Config types, `defineConfig`/`defineCollection`, `resolveConfig` (jiti load, up to 3 parent dirs, defaults)                                                                      |
| `core/diagnostic.ts`     | Diagnostic oracle (Ticket 23): `Diagnostic`, `VeliteError`, `fail()`, the `DiagnosticValue` normalizer, canonical equality/ordering, `hasFatalDiagnostic`, `codeFromDiagnostics` |
| `core/driver.ts`         | Build-time orchestration: `RunContext`, named phases `resolveAssets`/`runPrepareHook`/`copyAssets`, incremental patching, `applyChanges` (watch)                                 |
| `core/prepare.ts`        | The prepare hook's sole `addDiagnostic` sink: shape validation, same-key collapse/conflict, settlement close                                                                     |
| `core/scheduler.ts`      | Debounced serial rebuild queue for watch mode                                                                                                                                    |
| `core/classify.ts`       | Route a `FileEvent` to `config` / `content` / `ignore`                                                                                                                           |
| `core/model.ts`          | Shared domain vocabulary: `Source`, `Collection`, `Entry`, `RawEntry`, `CollectionResult`                                                                                        |
| `core/index.ts`          | Core barrel (re-exports only what cross-module callers need)                                                                                                                     |
| `core/content/`          | Record-owned Parse/Transform/Emit executions, Markdown/MDX adapters, bounded source/navigation snapshots, and actual heading anchors                                             |
| `core/engine/`           | Incremental memoized derivation graph: `createEngine`, dependency tracking, staleness, in-flight dedup, `EngineError` (cycle/missing-input)                                      |
| `core/loader/`           | Source loaders (pure): `json`, `yaml`, `matter` (frontmatter); `createLoaderRegistry` (custom-first); `defineLoader`                                                             |
| `core/output/`           | Output planning + writer: `LogicalOutput`, `planWrites` (single/split), `writeOutput` (hash + skip-unchanged + stale cleanup), `OutputManifest`, type declaration                |
| `core/pipeline/`         | Derivation graph (the core computation): `createPipeline` composing `sources`→`load`→`validate`→`collect`→`uniqueCheck`→`emit` + `asset` derivation                              |
| `core/schema/`           | Zod namespace `s`, separate `content` definitions/result schemas, eight-field `context()`, effects; `file`, `image`, `slug`, `path`, `raw`, `isoDate`, `unique`                  |
| `core/util/`             | Pure helpers (no `node:*`): posix `path`, FNV-1a `hash`, `glob` matcher, identity, string `compare`, bounded `pool`                                                              |
| `runtime/`               | Runtime ports: `FileSystem`, `ImageProcessor`, `Logger`, `ModuleLoader`, `Watcher`, `ContextStorage`; `createContext` ambient-value accessor                                     |
| `runtime/adapters/node/` | Node adapters: `node:fs`+tinyglobby, sharp (lazy), jiti modules, chokidar watcher, `AsyncLocalStorage` context — the only place `node:*`/native imports live                     |

## Key patterns

- `s` is the extended Zod namespace (`src/core/schema/s.ts`) — re-exports all of `zod` plus custom schemas
- `content.markdown()` / `content.mdx()` create definitions, not Zod schemas; finite methods return result schemas. Reuse one definition and exact selected input within a record for shared execution
- User config files (`velite.config.{js,ts,mjs,mts,cjs,cts}`) are loaded with **jiti** at runtime (`src/core/config.ts`), not bundled with tsdown
- Config is searched up to 3 parent directories from cwd (`src/core/config.ts`)
- Default content root: `content/`, default output: `.velite/` (data) + `public/static/` (assets)
- `defineConfig`, `defineCollection`, `defineLoader`, `defineSchema` are identity helpers for type inference only
- The `prepare` hook can return `false` to suppress default file output
- Bundled with **tsdown** (rolldown/Rust), not tsup (esbuild)
- Build-scoped mutable state lives on the driver's `RunContext` (`src/core/driver.ts`); `SessionStore` holds the per-build schema-context store. Independent builds are isolated by construction
- Schema cross-file state uses the effects model (collect → validate → commit via `collectEffect`), not direct mutation
- `context()` (`src/core/schema/context.ts`) returns the `SchemaContext` (project, file, record, store, collectEffect, asset, readFile, probeImage) — built-in and user schemas have the same capability boundary. See `.agents/knowledge/schema-context.md`

## Module organization

- For source architecture changes, read `.agents/knowledge/module-architecture.md` first. It covers factory DI rules, composition roots, allowed direct exports, and prohibited patterns in one place.
- For content APIs, source selections, heading navigation, or plugin ownership, read `.adr/0001-share-semantic-content-results.md` and `.adr/0002-content-definition-and-anchor-contract.md`. They define the implemented execution/value contract; active ownership guidance is in `.agents/knowledge/module-architecture.md`.
- Dependency-bearing modules, stateful modules, lifecycle-managed modules, runtime adapters, and composition modules must use explicit factory DI. Dependencies must be visible, typed, and wired at a composition root.
- Do not introduce IoC containers, service locators, decorator injection, runtime auto-registration, or hidden singleton services unless explicitly requested.
- Do not force factory wrappers onto pure functions, type-only modules, constants, error classes, schema builders, identity helpers, or public facade functions unless they gain external dependencies, lifecycle state, or a replaceable capability boundary.
- For the `context()` ambient accessor (the one allowed exception), see `.agents/knowledge/schema-context.md`.
- For schema Promise abandonment or runner runtime wiring, read `.adr/0003-observe-scoped-schema-promises.md`: the separately injected private runtime observer is authorized; public context/exports remain unchanged.

## Code style

- Prettier: no semicolons, single quotes, no trailing commas, 160 char width
- Import sorting via `@ianvs/prettier-plugin-sort-imports` (configured in `prettier.config.js`)
- Pre-commit hook: `simple-git-hooks` → `lint-staged` → `prettier --write`

## Testing

```bash
pnpm test   # runs: pnpm build && node --import jiti/register --test 'test/**/*.tests.ts'
```

- Tests in `test/` use `node:test` + `node:assert`
- Tests run against the **built** output (`dist/`), so `pnpm build` must run first — config fixtures self-reference `velite` through the jiti alias (`velite → dist/index.mjs`), so even `test/core/` / `test/runtime/` suites need a build; there is no src-only test command
- `test/dist/` holds the suites that exercise the built artifact directly (package contract + benches); `test/integration/` builds the `examples/*` fixtures end-to-end
- `test/integration/basic.tests.ts` checks the generated output content of `examples/basic`
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

- **Plans, specs, tickets, intermediate notes, per-task reports** go under `.agents/sessions/YYYYMMDD-HHmm-{slug}/`.
- **Save plans to:** `.agents/sessions/YYYYMMDD-HHmm-{slug}/plan.md` instead of the plugin or skill presets.
- **Save specs to:** `.agents/sessions/YYYYMMDD-HHmm-{slug}/spec.md` instead of the plugin or skill presets.
- **Save tickets to:** `.agents/sessions/YYYYMMDD-HHmm-{slug}/tickets/NN-<slug>.md` instead of the plugin or skill presets.
- Session subfolders are gitignored by default — never put long-lived conventions there; promote them to `.agents/knowledge/` instead.
- Full rules: `.agents/AGENTS.md`

## Subdirectory AGENTS.md

Load a subdirectory's `AGENTS.md` when you are about to work primarily in that directory:

| When working in                           | Load                 |
| ----------------------------------------- | -------------------- |
| `packages/next` or `packages/vite`        | `packages/AGENTS.md` |
| Planning, research, or session management | `.agents/AGENTS.md`  |

Skip if you are only passing through (e.g. a quick grep or single-file read).

## Agent skills

### Issue tracker

Issues are session-scoped: tickets live inside `.agents/sessions/<session>/tickets/`. See `.agents/issue-tracker.md`.

### Triage labels

Five default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `.agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `.adr/`. See `.agents/domain.md`.
