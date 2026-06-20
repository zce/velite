# `packages/` — Framework Plugins

Two integration packages, both hand-written JavaScript (no build step):

| Package          | npm name              | What it does                                   |
| ---------------- | --------------------- | ---------------------------------------------- |
| `packages/next/` | `@velite/plugin-next` | Next.js config plugin (dev watch + prod build) |
| `packages/vite/` | `@velite/plugin-vite` | Vite plugin (dev watch + prod build)           |

## Key facts

- **Plain JS** — no TypeScript, no build step. Ship `index.js` + `index.d.ts` directly.
- Both depend on `velite` via `workspace:*`; `pnpm pack`/publish rewrites it to the matching release version.
- Both call the core library; the Vite plugin uses `watch()` in dev and closes it with the Vite server, while production builds use `build()`.
- `.d.ts` files are hand-written type declarations, not generated.
- `node_modules/` inside each package is a symlink created by pnpm (for the workspace peer dep resolution) — ignore it.

## When editing

- Keep the JS minimal and framework-version-agnostic.
- Update `index.d.ts` in sync with any API changes to `index.js`.
- Bump `peerDependencies` ranges when a new framework major is supported.
- Verify via the root `pnpm test`, which includes package metadata checks, Vite watcher behavior, and framework example builds.
