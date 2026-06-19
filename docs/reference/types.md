# Types

## VeliteImage

```ts
/**
 * Image object with metadata & blur image
 */
interface VeliteImage {
  /**
   * public url of the image
   */
  src: string
  /**
   * image width
   */
  width: number
  /**
   * image height
   */
  height: number
  /**
   * blurDataURL of the image
   */
  blurDataURL: string
  /**
   * blur image width
   */
  blurWidth: number
  /**
   * blur image height
   */
  blurHeight: number
}
```

## VeliteLoader

```ts
/**
 * File loader
 */
interface VeliteLoader {
  /**
   * File test regexp
   * @example
   * /\.md$/
   */
  test: RegExp
  /**
   * Load file data from file.value
   * @param file vfile
   */
  load: (file: VFile) => Promisable<Data>
}
```

## ContentFile

```ts
interface ContentFile {
  /**
   * Absolute source file path.
   */
  readonly path: string

  /**
   * Content body without frontmatter, when available.
   */
  readonly content?: string

  /**
   * Parsed Markdown AST, when content is available.
   */
  readonly mdast?: Root

  /**
   * Parsed HTML AST, when content is available.
   */
  readonly hast?: Nodes

  /**
   * Plain text extracted from content, when available.
   */
  readonly plain?: string
}
```

## BuildContext

```ts
interface BuildContext {
  /**
   * Resolved config being used.
   */
  readonly config: ResolvedConfig

  /**
   * Current file being parsed.
   */
  readonly file: ContentFile

  /**
   * Build-scoped shared state for advanced custom schemas and plugins.
   */
  readonly store: BuildStore
}
```

Use [`context()`](./api.md#context) inside custom schema callbacks to access `BuildContext`.

`BuildContext` is the public schema-time view for the current build or watch rebuild. Internally Velite keeps a larger build session with caches, diagnostics, and output state, but that session is not a public extension point.

## BuildStore

```ts
type StoreKey = string | symbol

interface BuildStore {
  get<T>(key: StoreKey): T | undefined
  set<T>(key: StoreKey, value: T): void
  getOrCreate<T>(key: StoreKey, create: () => T): T
  has(key: StoreKey): boolean
}
```

`BuildStore` lives for the current build or watch rebuild. Use `context().store` when a custom schema or plugin needs shared state without module-level globals.

## HookContext

```ts
type HookContext = {
  /**
   * Resolved config.
   */
  config: ResolvedConfig
}
```

Hook callbacks such as `prepare` and `complete` receive this context type.

## MarkdownOptions

```ts
/**
 * Markdown options
 */
interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
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
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Output format to generate.
   * @default 'function-body'
   */
  outputFormat?: CompileOptions['outputFormat']
  /**
   * Minify the output code.
   * @default true
   */
  minify?: boolean
}
```

Refer to [MDX](https://mdxjs.com/packages/mdx/#compileoptions) for more information about `CompileOptions`.
