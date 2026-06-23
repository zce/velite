// TS consumer smoke test: proves that `import type { ... } from 'velite'`
// resolves through the package's export map and types field. Run via
// `tsc --noEmit` in the dist contract integration test.
//
// If the export map or .d.mts is misconfigured, this file will produce
// compile errors even though the runtime import works fine.
import { defineCollection, defineConfig, s } from 'velite'

import type { BuildResult, Infer, Schema, SchemaContext, UserConfig } from 'velite'

// Verify the types are usable, not just importable.
type PostSchema = Schema<{ title: string }>
type PostData = Infer<PostSchema>
const _check: PostData = { title: 'test' }

// Verify BuildResult shape — just reference the type, don't construct it
// (LogicalOutput has a complex shape we don't need to exercise here).
type _BR = BuildResult
const _result = {} as _BR
void _result.diagnostics
void _result.written

// Verify SchemaContext has the expected fields.
const _ctx = {} as SchemaContext
void _ctx.project
void _ctx.file
void _ctx.record
void _ctx.store

// Verify UserConfig shape.
const _config = {} as UserConfig
void _config.root
void _config.collections

defineConfig({
  collections: {
    posts: defineCollection({ pattern: 'posts/*.json', schema: s.object({ title: s.string(), draft: s.boolean().default(false) }) }),
    site: defineCollection({ pattern: 'site.json', single: true, schema: s.object({ name: s.string() }) })
  },
  prepare: ({ posts, site }) => {
    const title: string = posts[0]!.title
    const draft: boolean = posts[0]!.draft
    const siteName: string = site.name

    // @ts-expect-error unknown collection keys are not available in the typed prepare view
    posts[0]!.missing
    // @ts-expect-error single collections are objects, not arrays
    site.push({ name: 'x' })

    void title
    void draft
    void siteName
  }
})

void _check
