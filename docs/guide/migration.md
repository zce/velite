# Migration to 1.0 Alpha

Velite 1.0 alpha modernizes the parser pipeline around Zod 4 and introduces framework plugins for app integrations. This guide covers the changes you should apply when upgrading from `0.3.x` or an earlier `1.0.0-alpha` build.

## Upgrade Packages

Install the alpha release and update your package manager lockfile:

```bash
pnpm add -D velite@1.0.0-alpha.3
```

If you use the framework plugins, install the matching package:

```bash
pnpm add -D @velite/plugin-next@latest
pnpm add -D @velite/plugin-vite@latest
```

## Runtime Requirements

Velite now targets Node.js `>=22.13.0`.

This aligns the package with current versions of the runtime dependencies used by the build and watch pipeline. Update local development, CI, and deployment environments before upgrading.

## Zod 4 Schema Semantics

Velite now uses the official `zod` package internally. The `s` helper is the public schema namespace and includes Velite-specific schemas plus all Zod schema helpers. Use `s` instead of importing `z` from `velite`.

```ts
import { s } from 'velite'

const post = s.object({
  title: s.string(),
  slug: s.path()
})
```

### Replace `ctx.meta` With `context()`

The parser no longer passes Velite file metadata through Zod's transform context. Use `context()` to access the current file, resolved config, and build-scoped store.

Before:

```ts
import { s } from 'velite'

export const sourcePath = () =>
  s.custom<string>().transform((value, { meta }) => {
    return value ?? meta.path
  })
```

After:

```ts
import { context, s } from 'velite'

export const sourcePath = () =>
  s
    .custom<string>(value => typeof value === 'string')
    .optional()
    .transform(value => {
      return value ?? context().file.path
    })
```

The `context()` function returns:

```ts
{
  project: ProjectInfo
  file: ContentFile
  record: ContentRecord
  store: SessionStore
  collectEffect: (effect: Effect) => void
  asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readFile: (absPath: string) => Promise<Uint8Array>
  probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}
```

### Mark Custom Context-Derived Fields as Optional

In Zod 4, object keys are required unless the schema is explicitly optional. If a custom schema field is usually missing from frontmatter and should be derived from the current file, add `.optional()` before `.transform()`.

Before:

```ts
const posts = defineCollection({
  schema: s.object({
    content: s.custom<string | undefined>().transform(value => value ?? context().file.content ?? '')
  })
})
```

After:

```ts
const posts = defineCollection({
  schema: s.object({
    content: s
      .custom<string>(value => typeof value === 'string')
      .optional()
      .transform(value => value ?? context().file.content ?? '')
  })
})
```

Velite's built-in file-derived schemas already include this optional wrapper because missing fields are their normal derivation input. This includes `s.path()`, `s.raw()`, `s.markdown()`, `s.mdx()`, `s.excerpt()`, `s.metadata()`, and `s.toc()`.

Value-required schemas do not include this wrapper. Use `.optional()` yourself when fields such as `s.file()`, `s.image()`, `s.slug()`, `s.unique()`, or `s.isoDate()` should be optional.

### Do Not Use `addIssue()` for Warnings

Zod 4 treats any `ctx.addIssue()` call as a validation failure. `fatal: false` does not mean "warning" and does not keep the parse result successful.

Before:

```ts
s.string().transform((value, ctx) => {
  ctx.addIssue({ fatal: false, code: 'custom', message: 'Using fallback value' })
  return value
})
```

After:

```ts
s.string().transform(value => {
  return value
})
```

Only call `ctx.addIssue()` when the current value should fail validation.

## Asset Internals

Velite 1.0 keeps low-level asset collection state internal. Custom schemas should use public schemas such as `s.file()` and `s.image()` for asset references, or return their own URLs directly.

The internal asset store, linked-file remark/rehype plugins, and `processAsset()` are not public extension APIs. Do not import from `velite/dist/*` or source internals such as `src/assets/*`; those paths are implementation details and may change without a compatibility layer.

## Next.js Integration

Use `@velite/plugin-next` instead of manually starting Velite from `next.config.ts`.

Before:

```ts
const isDev = process.argv.includes('dev')
const isBuild = process.argv.includes('build')

if (!process.env.VELITE_STARTED && (isDev || isBuild)) {
  process.env.VELITE_STARTED = '1'
  import('velite').then(m => (isDev ? m.watch({ clean: false }) : m.build({ clean: true })))
}

export default {}
```

After:

```ts
import { withVelite } from '@velite/plugin-next'

export default withVelite()
```

To pass Velite options:

```ts
import { createNextPlugin } from '@velite/plugin-next'

const withVelite = createNextPlugin({ config: './velite.config.ts' })

export default withVelite({
  reactStrictMode: true
})
```

## Vite Integration

`@velite/plugin-vite` supports Vite 5 through Vite 8. Keep the plugin in your Vite config and upgrade Vite normally:

```ts
import velite from '@velite/plugin-vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [velite(), react()]
})
```

## Type Exports

The public entry exports Zod-related type helpers for schema typing:

```ts
import type { Infer, Schema } from 'velite'
```

Use `context()` for Velite parser metadata instead of relying on `ZodMeta`.

## Recommended Upgrade Checklist

- Update Node.js to `>=22.13.0` in local development and CI.
- Upgrade `velite` to `1.0.0-alpha.3`.
- Replace `import { z } from 'velite'` with `import { s } from 'velite'`.
- Replace `ctx.meta` access with `context()`.
- Add `.optional()` to custom schemas that derive missing object fields from the current file.
- Remove `ctx.addIssue({ fatal: false, ... })` warning patterns.
- Switch Next.js projects to `@velite/plugin-next`.
- Run `velite build`, your app build, and your type checks.
