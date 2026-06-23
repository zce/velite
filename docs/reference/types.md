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
/** Input handed to a loader: a source's identity plus its decoded content. */
interface LoaderInput {
  /** Content-root-relative POSIX source path (relative to `config.root`). */
  path: string
  bytes: Uint8Array
  text: string
}

/** One parsed item before schema validation. */
interface LoadedItem {
  /** Stable key within the source (loader-provided, or array index fallback). */
  key: string | number
  data: unknown
  meta?: Record<string, unknown>
}

interface LoaderResult {
  items: LoadedItem[]
  diagnostics?: Diagnostic[]
}

/**
 * Turns a source's content into one or more raw items. Pure and side-effect free:
 * no schema validation, no output writing, no filesystem access.
 */
interface Loader {
  name: string
  /**
   * Match by file extension (with dot, e.g. '.json') or a custom predicate.
   * The predicate receives the same content-root-relative POSIX path that
   * `LoaderInput.path` carries.
   */
  match: string[] | ((path: string) => boolean)
  load(input: LoaderInput): LoaderResult
}
```

Use [`defineLoader()`](./api.md#defineloader) for the recommended identity helper. See [Custom Loaders](../guide/custom-loader.md) for end-to-end examples.

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
  /** Absolute content root directory (POSIX). */
  readonly root: string
  /** Absolute config file path. */
  readonly configPath: string
  /** Resolved collections keyed by collection name. */
  readonly collections: Readonly<Record<string, ProjectCollectionInfo>>
  /** Resolved output settings (data dir, assets dir, base url, name template). */
  readonly output: {
    readonly data: string
    readonly assets: string
    readonly base: string
    readonly name: string
  }
  readonly markdown?: MarkdownOptions
  readonly mdx?: MdxOptions
}

interface ProjectCollectionInfo {
  /** Glob include patterns relative to the content root. */
  readonly pattern: readonly string[]
  /** Single-item output (one entry) instead of a list. */
  readonly single: boolean
  /** Per-entry schema. */
  readonly schema: unknown
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
  /** Builder/session-scoped store for advanced custom schemas. */
  readonly store: SessionStore
  /** Declare a schema effect (unique registration, asset reference, etc.). */
  readonly collectEffect: (effect: Effect) => void
  /**
   * Resolve an asset by its key (content-root-relative POSIX source path,
   * i.e. relative to `context().project.root`). Returns the memoized
   * {@link AssetResult}: `publicUrl` is always available; image metadata is
   * zero until the driver feeds the asset's bytes in pass 2.
   */
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  /** Read an asset's bytes directly (used by `s.image({ absoluteRoot })`). */
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  /** Probe + blur an image's bytes directly, returning width/height/blurDataURL/etc. */
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}

interface AssetRequest {
  /** Override the global `output.name` template for this asset. */
  template?: string
  /** Override the global blur dimensions/quality. */
  blur?: BlurOptions
}

interface ImageMetadata {
  width: number
  height: number
  format: string
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}
```

Use [`context()`](./api.md#context) inside custom schema callbacks to access `SchemaContext`. All fields are available to built-in and user-defined schemas alike — there is no internal-only tier.

The asset key passed to `context().asset()` is the **content-root-relative POSIX source path** of the asset — i.e. the path relative to `context().project.root` (the value of `root` in your config, default `content/`). It is the same key `s.image()` / `s.file()` derive internally from a content-relative `src`.

## AssetResult

```ts
interface AssetResult {
  /** Public url of the asset (base + content-hashed name once bytes are known). */
  publicUrl: string
  /** Image width (0 when no bytes / no processor / probe failed). */
  width: number
  /** Image height (0 when no bytes / no processor / probe failed). */
  height: number
  /** Detected image format (empty string when unknown / non-image). */
  format: string
  /** Blur placeholder data URL (empty string when unavailable). */
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}
```

Returned by `context().asset()`. The first pass through emit sees the placeholder shape (zero metadata, key-derived `publicUrl`); the driver then feeds the asset bytes and the second pass recomputes the real values.

## Effect

```ts
type Effect = UniqueEffect | AssetReferenceEffect

interface UniqueEffect {
  readonly type: 'unique'
  readonly owner: string
  readonly group: string
  readonly value: string
}

interface AssetReferenceEffect {
  readonly type: 'asset'
  readonly owner: string
  readonly assetPath: string
  readonly publicUrl: string
  readonly isImage: boolean
}
```

Effects are how schemas declare cross-file intent without mutating shared state mid-parse. Built-in schemas like `s.unique()` and `s.image()` emit these; custom schemas can do the same through `context().collectEffect(...)`. The pipeline collects each record's effects and validates them as a set after parse, so concurrent record validation stays deterministic.

## SessionStore

```ts
interface SessionStore {
  get<T>(key: string | symbol): T | undefined
  has(key: string | symbol): boolean
  getOrCreate<T>(key: string | symbol, create: () => T): T
}
```

`SessionStore` is **builder/session-scoped**: a single store is created once per build session and shared across every `Builder.build()`, `apply()`, and watch rebuild on that builder. It is replaced wholesale only when the config reloads (which tears the pipeline down), and dropped when the builder is disposed. There is deliberately no `set()` — built-in cross-file schemas use the internal schema-effects model so concurrent validation stays deterministic. Custom schemas that need lazily-initialized shared state should use `getOrCreate()` and manage their own invalidation: stored state survives rebuilds, so anything derived from content (e.g. an aggregate count) must either re-derive on every call or be invalidated explicitly when the underlying content changes.

## Schema

```ts
type Schema<T = unknown> = z.ZodType<T>
```

The package re-exports this as the public alias for `z.ZodType` so user code can express schemas without importing zod directly.

## Infer

```ts
type Infer<TSchema extends Schema> = z.infer<TSchema>
```

Infer the validated output type of a Velite schema. Lower-case `infer` is taken by the TypeScript keyword; `Infer` is the exported name.

## CollectionDef

```ts
interface CollectionDef<TSchema extends Schema = Schema> {
  /** Glob pattern(s) relative to `root`, supporting `!negation`. */
  pattern: string | string[]
  /** Extra exclude patterns. */
  exclude?: string | string[]
  /** Single-item output (one entry) instead of a list. */
  single?: boolean
  /** Generated TypeScript type name (defaults to the collection key). */
  typeName?: string
  /** Schema validating and transforming each record. */
  schema: TSchema
}
```

The user-facing collection definition handed to [`defineCollection()`](./api.md#definecollection) or written inline in `UserConfig.collections`.

## CollectionResult

```ts
type CollectionResult<TSchema extends Schema, TSingle extends boolean | undefined> = TSingle extends true ? Infer<TSchema> : Array<Infer<TSchema>>
```

The validated runtime shape for a single collection — an array for list collections, a single object for `single: true` collections.

## BuildResult

```ts
interface BuildResult {
  /** Logical output: per-collection entries after schema validation and prepare. */
  readonly output: LogicalOutput
  /** Diagnostics surfaced during the build run (errors, warnings, info). */
  readonly diagnostics: readonly Diagnostic[]
  /** Absolute paths of output files written this run (unchanged files are skipped). */
  readonly written: readonly string[]
}
```

`BuildResult` is the value resolved by [`build()`](./api.md#build) and passed to the `onRebuild` callback of the lower-level `Builder.watch()`. Schema-level errors are non-fatal and surface through `diagnostics`; non-schema fatal errors reject the promise with a [`VeliteError`](./api.md#veliteerror) instead.

## PrepareCollections

```ts
type PrepareCollections = Record<string, unknown[] | unknown>
```

The friendly view of the build output passed to the [`prepare`](../guide/config.md#prepare) hook: a record keyed by collection name. List collections expose an array of validated records; `single: true` collections expose the single record directly. The hook may mutate values in place, return a `{ collections, diagnostics }` replacement, or return `false` to suppress all default output (Velite reconciles its own previously-written data and asset files to empty in that case — caller-written files are untouched).

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
