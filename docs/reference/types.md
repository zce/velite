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
  /** Stable source id (content-root-relative POSIX path, relative to the config `root`). */
  readonly id: string
  /** Absolute source file path. */
  readonly path: string
  /** Raw text content (e.g. Markdown/MDX body), when available. */
  readonly content?: string
}
```

There are no `plain`, `mdast`, or `hast` getters. Use a Content Definition for source analysis and navigation, or let an independent custom schema own its parser. Content execution state is not part of the file model.

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

## ContentNamespace

```ts
interface ContentNamespace {
  readonly markdown: (options?: MarkdownDefinitionOptions) => MarkdownDefinition
  readonly mdx: (options?: MdxDefinitionOptions) => MdxDefinition
}
```

The root runtime export `content` has this type. Its two factories return definitions, not Zod schemas. Factories are not additional root-level exports or members of `s`.

## MarkdownDefinition / MdxDefinition

```ts
import type { ZodType } from 'zod'

interface MarkdownDefinition {
  html(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}

interface MdxDefinition {
  code(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}
```

Each method returns an ordinary async Zod schema; input/output inference and native wrappers remain Zod behavior. Extracting a method preserves definition identity without a `this` binding. There is no public processor, AST, VFile, cache, generic projection, or lifecycle interface. See [Content Definitions](../guide/content-executions.md).

## Content Definition Options

```ts
interface MarkdownDefinitionOptions extends MarkdownOptions {}
interface MdxDefinitionOptions extends MdxOptions {}
```

These have the same supported fields as the corresponding [global Markdown](#markdownoptions) and [global MDX](#mdxoptions) options, but configure one definition. Scalar definition values override globals; definition-local plugins precede global plugins within each phase. Established options/registration values are treated as immutable without recursively cloning or freezing opaque plugin arguments. Only excerpt length belongs to a result selection.

## ExcerptSchemaOptions

```ts
interface ExcerptSchemaOptions {
  /** Non-negative safe-integer Unicode code-point limit. @default 260 */
  length?: number
}
```

Invalid explicit length configuration synchronously throws `TypeError` at schema construction. Truncation appends `…` outside the requested limit and does not split valid surrogate pairs.

## TocItem

```ts
interface TocItem {
  depth: number
  title: string
  id: string
}
```

A flat transformed-heading navigation item: level 1–6, complete normalized static title, and actual output target without a leading `#`. There is no `slug` alias or nested TOC tree. Every result delivery has detached arrays and item objects.

## Metadata

```ts
interface Metadata {
  readingTime: number
  wordCount: number
}
```

Static pre-transform source analysis: weighted word count and rounded reading time in minutes, with a minimum of one. Metadata is detached per delivery. See [Source Analysis](../guide/content-executions.md#source-analysis-versus-navigation) for values and Unicode rules.

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
  /**
   * Declare a schema effect — the two-arg form `(declaration, context)` is
   * the API. Velite supplies the system owner/source provenance at commit
   * time; the schema supplies the semantic payload and the declaration
   * context (see [SchemaEffectDeclaration](#schemeeffectdeclaration)).
   */
  readonly collectEffect: (declaration: SchemaEffectDeclaration, context: EffectDeclarationContext) => void
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
  /** Probe image metadata. `s.file()` and linked files only need the public URL. */
  metadata?: boolean
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
  /** Whether the result was derived from real bytes instead of a placeholder. */
  resolved: boolean
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

## BlurOptions

```ts
interface BlurOptions {
  /** Blur image width. @default 8 */
  width?: number
  /** Blur image height. @default derived from aspect ratio */
  height?: number
  /** WebP quality of the blur image (1-100). @default 1 */
  quality?: number
}
```

Controls the low-resolution blurred placeholder generated alongside image assets. Passed per-schema via `s.image({ blur })` or per-request via `context().asset(key, { blur })`.

## Effect

The committed effect representation Velite produces from schema declarations:

```ts
type Effect = UniqueEffect | AssetReferenceEffect

interface UniqueEffect {
  readonly type: 'unique'
  readonly group: string
  readonly value: string
  readonly system: EffectSystemOwner
  readonly request?: EffectRequestProvenance
}

interface AssetReferenceEffect {
  readonly type: 'asset'
  /** Content-root-relative POSIX identity of the referenced asset. */
  readonly assetKey: string
  /** Output name template the reference was declared with. */
  readonly template: string
  /** Whether image metadata (probe + blur) was requested. */
  readonly metadata: boolean
  /** Blur options the reference was declared with (image assets only). */
  readonly blur?: BlurOptions
  readonly system: EffectSystemOwner
  readonly request?: EffectRequestProvenance
}
```

`system` is Velite-supplied provenance (which record declared the effect); `request` records which schema declaration produced it, when applicable.

```ts
interface EffectSystemOwner {
  /** Owning record id (`sourceId#key` or `sourceId#index`). */
  readonly owner: string
  /** Collection order in the resolved config. */
  readonly collectionOrder: number
  /** Collection id. */
  readonly collectionId: string
  /** Content-root-relative POSIX source path. */
  readonly sourcePath: string
  /** Record source index. */
  readonly recordIndex: number
  /** Record id. */
  readonly recordId: string
}

interface EffectRequestProvenance {
  /** Request kind (e.g. 'custom'). */
  readonly kind: string
  /** Stable declaration ordinal. */
  readonly declaration: number
  readonly projection?: string
  readonly occurrence?: StableOccurrence
}
```

Effects are how schemas declare cross-file intent without mutating shared state mid-parse. Built-in schemas like `s.unique()` and `s.image()` emit these; custom schemas declare the same intent through `context().collectEffect(declaration, context)` (see [SchemaEffectDeclaration](#schemaeffectdeclaration)). The pipeline collects each record's effects and validates them as a set after parse, so concurrent record validation stays deterministic.

## SchemaEffectDeclaration

The declaration a schema passes to `context().collectEffect(declaration, context)`:

```ts
type SchemaEffectDeclaration = UniqueEffectDeclaration | AssetReferenceEffectDeclaration

interface UniqueEffectDeclaration {
  readonly type: 'unique'
  readonly group: string
  readonly value: string
}

interface AssetReferenceEffectDeclaration {
  readonly type: 'asset'
  /** Absolute source path of the referenced asset. */
  readonly source: string
  readonly output: {
    readonly base: string
    readonly template: string
  }
  readonly metadata: boolean
  readonly blur?: {
    readonly width?: number
    readonly height?: number
    readonly quality?: number
  }
}
```

## EffectDeclarationContext

Velite supplies the second argument to `collectEffect`:

```ts
interface EffectDeclarationContext {
  /** Record-rooted semantic declaration path. */
  readonly path: readonly (string | number)[]
  /** Stable declaration ordinal within the record. */
  readonly declaration: number
  /** One validated stable occurrence: `singleton`, `source-index`, or `key`. */
  readonly occurrence: StableOccurrence
}
```

```ts
type StableOccurrence = { kind: 'singleton' } | { kind: 'source-index'; index: number } | { kind: 'key'; key: string }
```

How the declaring record is anchored inside its source file: a single record per file, the n-th record, or a loader-provided key. Velite validates and freezes the occurrence before handing it to the schema.

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
interface CollectionResult<T = unknown> {
  collection: Collection
  mode: 'list' | 'single'
  entries: Entry<T>[]
}
```

The result of one collection as exposed on [`BuildResult.output`](#buildresult): the collection definition, whether it was declared `single`, and its ordered validated entries.

## LogicalOutput

```ts
interface LogicalOutput {
  collections: Record<string, CollectionResult>
}
```

The complete, deterministic build result keyed by collection name. Physical layout (single vs split files) is a writer concern — `LogicalOutput` is layout-independent.

## Entry

```ts
interface Entry<T = unknown> {
  /** Stable entry identity: `sourcePath#key` (or `sourcePath#index`). */
  id: `${string}#${string}`
  /** Content-root-relative POSIX source path. */
  source: string
  /** The validated, transformed record data. */
  data: T
}
```

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

`BuildResult` is the value resolved by [`build()`](./api.md#build) and passed to the `onRebuild` callback of the lower-level [`Builder.watch()`](./api.md#builder). Schema-level errors are non-fatal and surface through `diagnostics`; non-schema fatal errors reject the promise with a [`VeliteError`](./api.md#veliteerror) instead.

## Diagnostic

```ts
type DiagnosticLevel = 'error' | 'warn' | 'info'
type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

interface Diagnostic {
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly stage: DiagnosticStage
  readonly origin: { kind: 'core' } | { kind: 'prepare-hook'; key: string } | { kind: 'velite' }
  readonly provenance:
    | { scope: 'project' }
    | { scope: 'collection'; collection: { order: number; id: string } }
    | { scope: 'source'; collection?: { order: number; id: string }; source: { path: string } }
    | {
        scope: 'record'
        collection: { order: number; id: string }
        source: { path: string }
        record: { index: number; id: string }
        path?: readonly (string | number)[]
      }
  readonly position?: { start: { line?: number; column?: number; offset?: number }; end?: { line?: number; column?: number; offset?: number } }
  readonly context?: DiagnosticValue
  readonly cause?: DiagnosticValue
}
```

One surfaced issue from a build run. `provenance` scopes the diagnostic to the project, a collection, a source file, or a specific record (with an optional field `path` into the record). Schema-stage `error` diagnostics are **non-fatal** — the offending record is dropped from the output and the diagnostic is reported; error diagnostics from other stages fail the build with a `VeliteError`. `context`/`cause` values are normalized to a closed `DiagnosticValue` domain (primitives, plain records/arrays, and tagged shapes for exceptional values), so hostile `toString`/getters on user values cannot throw during rendering or comparison.

## PrepareCollections

```ts
type PrepareCollections = Record<string, unknown[] | unknown>
```

The friendly view of the build output passed to the [`prepare`](./config.md#prepare) hook: a record keyed by collection name. List collections expose an array of validated records; `single: true` collections expose the single record directly. The hook may mutate values in place, return a `{ collections }` replacement, or return `false` to suppress all default output (Velite reconciles its own previously-written data and asset files to empty in that case — caller-written files are untouched).

## PrepareContext

```ts
interface PrepareContext {
  /** Stable view of the resolved project. */
  readonly project: ProjectInfo
  /** Diagnostics known when the hook starts (read-only view). */
  readonly diagnostics: readonly Diagnostic[]
  /**
   * The sole channel for the hook to add diagnostics. Velite supplies the
   * `stage`, `origin`, and project provenance; the hook supplies `key`,
   * `level`, `code`, `message`, and optional `cause`.
   */
  readonly addDiagnostic: (diagnostic: PrepareDiagnosticInput) => void
}

interface PrepareDiagnosticInput {
  /** Stable key — the same key with a different payload is a conflict. */
  key: string
  level: 'error' | 'warn' | 'info'
  code: string
  message: string
  cause?: unknown
}
```

The `prepare` hook receives this context. Diagnostics cannot be returned from the hook — `addDiagnostic` is the only channel, and it closes when the hook settles (later calls throw). A declaration that does not match the `PrepareDiagnosticInput` shape is ignored: nothing of it is recorded, and velite appends a fatal `PREPARE_INVALID_INPUT` diagnostic instead, so the build fails with a structured error rather than an internal fault. There are no other lifecycle hooks in 1.0.

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
interface MdxOptions extends MarkdownOptions {
  /** Output format to generate. @default 'function-body' */
  outputFormat?: 'program' | 'function-body'
  /** Minify the output code. @default true */
  minify?: boolean
  /** Use development compilation. @default false */
  development?: boolean
  /** Recma plugins, included in complete Transform even for TOC-only demand. */
  recmaPlugins?: PluggableList
}
```

`MarkdownOptions` and `MdxOptions` describe project-wide defaults. The supported fields are bounded; Velite does not pass arbitrary MDX compiler options through. Within each phase, definition-local plugins precede global plugins under ordinary Unified registration semantics. See [configuration ownership](../guide/content-executions.md#configuration).
