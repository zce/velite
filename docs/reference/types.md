# Types

## ImageData

```ts
/**
 * Image object with metadata & blur placeholder
 */
interface ImageData {
  /** public url of the image */
  src: string
  /** image width */
  width: number
  /** image height */
  height: number
  /** blur placeholder data url */
  blurDataURL: string
  /** blur image width */
  blurWidth: number
  /** blur image height */
  blurHeight: number
}
```

## Loader

```ts
/**
 * A loader turns a source file into one or more raw records.
 */
interface Loader {
  /** File test regexp or predicate. @example /\.md$/ */
  test: RegExp | ((source: LoaderSource) => boolean)
  /** Load raw records from a source. */
  load: (source: LoaderSource, context: LoaderContext) => Promisable<LoaderResult>
}
```

See [Custom Loaders](../guide/custom-loader.md) for the full `LoaderSource`, `LoaderContext`, `LoaderResult` and `LoaderRecord` shapes.

## ContentFile

```ts
interface ContentFile {
  /** Stable source id (project-relative, POSIX). */
  readonly id: string
  /** Absolute source file path. */
  readonly path: string
  /** Raw text content (e.g. Markdown/MDX body), when available. */
  readonly content?: string
  /** Plain text extracted from content, when available. */
  readonly plain?: string
}
```

AST fields are intentionally not part of the stable 1.0 contract; derive anything else you need from `path`.

## ContentRecord

```ts
interface ContentRecord {
  /** Stable record id (`sourceId#key`). */
  readonly id: string
  /** Loader-provided record key, when available. */
  readonly key?: string
  /** Record index within its source. */
  readonly index: number
}
```

## ProjectInfo

```ts
interface ProjectInfo {
  /** Content root directory. */
  readonly root: string
  /** Resolved config file path. */
  readonly configPath: string
  /** Resolved collections. */
  readonly collections: Collections
}
```

## SchemaContext

```ts
interface SchemaContext {
  /** Stable view of the resolved project. */
  readonly project: ProjectInfo
  /** Current file being parsed. */
  readonly file: ContentFile
  /** Current record being parsed. */
  readonly record: ContentRecord
  /** Session-scoped store for advanced custom schemas. */
  readonly store: SessionStore
}
```

Use [`context()`](./api.md#context) inside custom schema callbacks to access `SchemaContext`.

`SchemaContext` is the public schema-time view for the current build or watch rebuild. Internally Velite keeps a larger build session with the dependency graph, caches, diagnostics, schema effects and output state, but that session is not a public extension point.

## SessionStore

```ts
interface SessionStore {
  get<T>(key: string | symbol): T | undefined
  has(key: string | symbol): boolean
  getOrCreate<T>(key: string | symbol, create: () => T): T
}
```

`SessionStore` belongs to the current build session: it is shared across rebuilds inside a watch session, destroyed at the end of a one-shot build, and reset on config reload. There is deliberately no `set()` — built-in cross-file schemas use the internal schema-effects model so concurrent validation stays deterministic. Use `context().store` when a custom schema needs lazily-initialized shared state.

## VeliteSchema

```ts
type VeliteSchema<Output = unknown, Input = unknown> = z.ZodType<Output, Input>
```

## InferSchema

```ts
type InferSchema<TSchema extends VeliteSchema> = z.infer<TSchema>
```

Infer the output type of a Velite schema. Use `InferSchema` (not lowercase `infer`, which clashes with the TypeScript keyword).

## Collection

```ts
interface Collection<TSchema extends VeliteSchema = VeliteSchema> {
  /** Generated TypeScript type name. */
  typeName: string
  /** Glob pattern(s) relative to `root`, supporting `!negation`. */
  pattern: string | string[]
  /** Whether the result is a single record instead of an array. */
  single?: boolean
  /** Schema validating and transforming each record. */
  schema: TSchema
}
```

## BuildResult

```ts
type CollectionResult<TCollection extends Collection> = TCollection['single'] extends true
  ? InferSchema<TCollection['schema']>
  : Array<InferSchema<TCollection['schema']>>

type BuildResult<TCollections extends Collections> = {
  [K in keyof TCollections]: CollectionResult<TCollections[K]>
}
```

`BuildResult` is the strongly typed per-collection data shape passed to the `prepare` hook.

## PrepareContext

```ts
interface PrepareContext {
  /** Stable view of the resolved project. */
  readonly project: ProjectInfo
  /** Diagnostics from the build run. */
  readonly diagnostics: readonly Diagnostic[]
}
```

The `prepare` hook receives this context. There are no other lifecycle hooks in 1.0.

## MarkdownOptions

```ts
/**
 * Markdown options
 */
interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown (GFM). @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Copy linked files to public path and replace their urls with public urls. @default true */
  copyLinkedFiles?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
}
```

Refer to [Unified](https://unifiedjs.com/explore/package/unified/#pluggablelist) for more information about `remarkPlugins` and `rehypePlugins`.

## MdxOptions

```ts
/**
 * MDX compiler options
 */
export interface MdxOptions extends Omit<CompileOptions, 'outputFormat'> {
  /** Enable GitHub Flavored Markdown (GFM). @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Copy linked files to public path and replace their urls with public urls. @default true */
  copyLinkedFiles?: boolean
  /** Output format to generate. @default 'function-body' */
  outputFormat?: CompileOptions['outputFormat']
  /** Minify the output code. @default true */
  minify?: boolean
}
```

Refer to [MDX](https://mdxjs.com/packages/mdx/#compileoptions) for more information about `CompileOptions`.
