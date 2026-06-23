// TS consumer smoke test: proves that `import type { ... } from 'velite'`
// resolves through the package's export map and types field. Run via
// `tsc --noEmit` in the dist contract integration test.
//
// If the export map or .d.mts is misconfigured, this file will produce
// compile errors even though the runtime import works fine.
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

void _check
