# TypeScript

Velite is written in TypeScript, and its output is designed to be consumed by TypeScript. This page covers the three places types flow: your config, the generated declarations, and your app's imports.

## Typed config

Write `velite.config.ts` and wrap it with `defineConfig` for full inference — collection keys become data export names, and `typeName` fields become the generated type names:

```ts
import { defineCollection, defineConfig, s } from 'velite'

const posts = defineCollection({
  typeName: 'Post',
  pattern: 'posts/**/*.md',
  schema: s.object({
    title: s.string(),
    slug: s.slug(),
    date: s.isoDate()
  })
})

export default defineConfig({
  collections: { posts }
})
```

`defineCollection` preserves the literal definition type, so the generated declarations below can infer `Post` from your schema without any manual mapping.

## Generated declarations

Every build emits `.velite/index.d.ts`, deriving each collection's type from its schema via the exported `Infer` helper:

```ts
// generated — do not edit
import type { Infer } from 'velite'
import type __vc from '../velite.config.js'

type Collections = typeof __vc.collections

export type Post = Infer<Collections['posts']['schema']>
export declare const posts: Post[]
```

Because the type is inferred from the Zod schema, it stays in sync by construction: change the schema, rebuild, and the app's types change. Optional fields are optional, transforms change output types, and `s.isoDate()` validates and normalizes to an ISO date string — validation and typing are the same statement.

## Importing in your app

```ts
import { posts } from './.velite'

import type { Post } from './.velite'
```

For cleaner imports, define a path alias in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "#content": ["./.velite"]
    }
  }
}
```

```ts
import { posts } from '#content'
```

::: tip

The generated `index.js` uses JSON import attributes (`import r0 from '...' with { type: 'json' }`). If your app's bundler runs Velite's output through its own pipeline (Next.js and Vite both handle this fine via the plugins), keep the default `esm` output format; switch `output.format` to `cjs` only for CommonJS consumers.

:::

## Reusable custom schemas

When you extract a schema into a variable, TypeScript's inference can lose the literal type. `defineSchema` is the identity helper for exactly that case:

```ts
import { context, defineSchema, s } from 'velite'

export const path = defineSchema(
  s
    .string()
    .optional()
    .transform(value => value ?? context().file.path)
)
```

See [Custom Schema](./custom-schema.md) for the full `context()` capability surface.
