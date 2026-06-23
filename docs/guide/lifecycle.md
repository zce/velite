# Lifecycle

Velite exposes one public lifecycle concept for schema code: the build context. Internally, Velite uses build sessions and caches to execute builds, but those details are not public extension points.

## Build Execution

Each `build()` call runs one build execution. It loads the config, discovers matching content files, parses records with collection schemas, runs hooks, writes generated data, and copies collected assets.

In watch mode, each rebuild is also a build execution. A rebuild may reuse internal output state so unchanged generated files can be skipped, but schema-visible state is scoped to the active build execution.

## Build Context

Use [`context()`](../reference/api.md#context) inside schema callbacks such as `.transform()`, `.refine()`, or `.superRefine()`.

```ts
import { context, s } from 'velite'

const sourcePath = s
  .string()
  .optional()
  .transform(value => value ?? context().file.path)
```

`context()` returns the current `SchemaContext`:

```ts
interface SchemaContext {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
  readonly collectEffect: (effect: Effect) => void
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}
```

The context is ambient, similar to request-scoped APIs. It is available only while Velite is parsing a schema for the current file.

## Build Store

`context().store` is an advanced API for state shared within the current build execution. It avoids module-level globals and prevents state from leaking across independent builds.

```ts
const key = Symbol('my-schema.state')

const counted = s.string().transform(value => {
  const state = context().store.getOrCreate(key, () => ({ count: 0 }))
  state.count += 1
  return value
})
```

Use `SessionStore` for custom schemas or plugins that need build-scoped registries, deduplication, or cross-field coordination.

## Internal Sessions

Velite internally creates a build session for each build or rebuild. The session owns mutable execution state such as file caches, resolved files, output state, diagnostics, logger injection, and the build store.

`BuildSession` is intentionally internal. Public code should use `context()` and the public `SchemaContext` shape instead of importing session internals.
