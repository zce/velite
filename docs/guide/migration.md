# Migration to 1.0 Alpha

Velite 1.0 alpha modernizes the parser pipeline around Zod 4, separates Content Definitions from result schemas, and introduces framework plugins for app integrations. This guide covers the changes you should apply when upgrading from `0.3.x` or an earlier `1.0.0-alpha` build.

The content sections describe the migrated 1.0 implementation. Older published alpha builds may not contain the `content` export; use a package build containing this migration, not compatibility aliases. This guide does not announce release acceptance.

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

## Replace Legacy Content Schemas

Import `content` alongside `s`. Create one explicit Markdown or MDX definition, then call its finite result-schema methods. A definition is not a Zod schema; native wrappers belong on the result schemas.

| Removed API                                         | Replacement                                      |
| --------------------------------------------------- | ------------------------------------------------ |
| `s.markdown(options)`                               | `content.markdown(options).html()`               |
| `s.mdx(options)`                                    | `content.mdx(options).code()`                    |
| `s.toc()` / old root `.toc()`                       | Reuse the selected dialect definition's `.toc()` |
| `s.excerpt(options)` / old root `.excerpt(options)` | Reuse its `.excerpt({ length })`                 |
| `s.metadata()` / old root `.metadata()`             | Reuse its `.metadata()`                          |

There are no compatibility aliases or `s.content` family. Standalone selections no longer infer a dialect from the file extension. Markdown has `.html()`, MDX has `.code()`, and both have `.toc()`, `.excerpt()`, and `.metadata()`.

```ts
import { content, defineConfig, s } from 'velite'

const postContent = content.markdown()

export default defineConfig({
  collections: {
    posts: {
      pattern: 'posts/**/*.md',
      schema: s.object({
        title: s.string(),
        html: postContent.html(),
        toc: postContent.toc(),
        excerpt: postContent.excerpt({ length: 160 }),
        metadata: postContent.metadata()
      })
    }
  }
})
```

### Reuse identity and selected input

The same definition and exact selected string share one execution within an actual record-validation attempt. Separate factory calls remain independent even with identical options. Aliasing a definition or its method preserves identity; different selected strings remain independent. No processing state is shared across records or independent builds.

Every field selects an explicit primitive string before falling back to `context().file.content` for `undefined` / an absent field. Explicit `''` is an empty-input issue, never a fallback. Missing or exactly empty selected content produces `The content is empty` without processor work. Whitespace-only non-empty input processes normally; other input types, including `null`, fail unless your own schema explicitly changes that policy.

### Keep processing options on the definition

Project-wide `markdown` and `mdx` options remain supported. Scalars resolve as definition option, then global option, then the existing default. `gfm`, `removeComments`, and `copyLinkedFiles` default to `true`; MDX `minify` defaults to `true`, `outputFormat` to `'function-body'`, and `development` to `false`. Plugin lists default to empty. Within each phase, definition-local plugins precede global plugins under ordinary Unified registration semantics, including MDX `recmaPlugins`.

Only excerpt length is selection-specific. Remove `original`, upstream TOC options, metadata tuning, and arbitrary compiler-option passthrough. Excerpt length is a non-negative safe integer, defaults to 260 Unicode code points, and appends `…` outside the limit when truncated; invalid configuration synchronously throws `TypeError`.

### Source analysis is not navigation

Excerpt and metadata use normalized static **pre-transform source text**, not raw source syntax, rendered output, or a `file.plain` getter. Plugins changing headings do not change those source values, even when analysis is requested later. Non-empty source with no visible text yields `''` and `{ readingTime: 1, wordCount: 0 }`.

TOC now follows statically known **transformed** headings. Replace TOC `slug` / nested `url` and `items` assumptions with flat `{ depth, title, id }` items and link to the actual `id`. Automatic IDs are present in HTML/code even without a TOC field. Legal unique explicit IDs remain the supported stable external-link contract; invalid or duplicate IDs produce recoverable content issues rather than silent renaming.

Static intrinsic MDX headings participate, but unknown components are not inferred as headings. Dynamic titles, expression-valued IDs, and spread-bearing targets are omitted with capability warnings only when TOC is requested. Velite does not evaluate expressions, imports, generated JavaScript, or components to derive navigation. Complete MDX transformation includes recma: a late recma failure withholds TOC as well as code. Runtime heading replacements must forward `id`, and later code plugins must preserve captured heading/anchor semantics. See [actual heading targets](content-executions.md#actual-heading-targets).

### Keep native Zod wrapper behavior

Result schemas accept `string | undefined` without adding `.optional()`. An outer `.optional()` does not guarantee that inner body processing is skipped: Zod may enter the transform even when it ultimately discards the value or issues. Actual inner requests determine work.

For conditional derivation, explicitly select input and preprocess missing/exactly empty text to a `null` sentinel with a `.nullable()` guard:

```ts
import { content, context, s } from 'velite'

const article = content.markdown()
const optionalHtml = s
  .preprocess(value => {
    const selected = value === undefined ? context().file.content : value
    return selected === undefined || selected === '' ? null : selected
  }, article.html().nullable())
  .transform(value => value ?? undefined)
```

This schema intentionally accepts `null` as the skip sentinel. Other non-string inputs still fail. The guard, not inferred wrapper scheduling, prevents the inner content demand.

### Recovery, detached results, and effects

`.catch()` recovers ordinary field-local content/plugin validation issues without retrying a failed stage or swallowing directly thrown invariant/lifecycle faults. Parse failure affects all selections; Transform failure affects TOC and generated content; Emit failure affects generated content only. Earlier successful semantic results remain available, including source analysis after a recovered Transform failure. Every TOC array/item and metadata object is detached per delivery, so consumer mutation cannot affect another field.

Failed-stage Velite declarations are discarded. Successful-stage declarations become eligible once per execution, but invalid records discard all sibling effects and valid candidates still pass cross-record/build publication gates. Recovery can retain successful lower-stage effects, not failed-stage effects. Direct plugin filesystem/network I/O is not rollbackable. TOC-only runs transformations and linked-asset resolution while skipping serialization/minification; it is not a zero-I/O mode.

See [Content Definitions](content-executions.md) for the full processing, recovery, and runtime limitations.

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

Velite's built-in `s.path()` and `s.raw()` already accept missing fields. Content Definition result schemas also accept missing input and select the file body; do not add `.optional()` to express a body-presence policy. Use explicit preprocessing when conditional derivation is required.

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

Content types are `ContentNamespace`, `MarkdownDefinition`, `MdxDefinition`, `MarkdownDefinitionOptions`, `MdxDefinitionOptions`, `ExcerptSchemaOptions`, `TocItem`, and `Metadata`. The definition types replace the old root types, and the definition option types replace the old schema option types without aliases. `TocItem.id` replaces `slug`. Before wrappers, every result schema has input type `string | undefined`; Zod output inference, `Infer`, and generated collection types reflect the selected result and native wrappers. No processor, AST, VFile, cache, or lifecycle types are public.

## Recommended Upgrade Checklist

- Update Node.js to `>=22.13.0` in local development and CI.
- Upgrade `velite` to `1.0.0-alpha.3`.
- Replace `import { z } from 'velite'` with `import { s } from 'velite'`.
- Replace legacy content roots and standalone selections with one reused Content Definition per related input.
- Update TOC links to actual `id` values and forward those IDs through runtime heading components.
- Keep source-analysis, native-wrapper, recovery, and TOC-only I/O semantics explicit.
- Replace `ctx.meta` access with `context()`.
- Add `.optional()` to custom schemas that derive missing object fields from the current file.
- Remove `ctx.addIssue({ fatal: false, ... })` warning patterns.
- Switch Next.js projects to `@velite/plugin-next`.
- Run `velite build`, your app build, and your type checks.
