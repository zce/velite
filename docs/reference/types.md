# Types

## Image

```ts
/**
 * Image object with metadata & blur image
 */
interface Image {
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

## Loader

```ts
/**
 * File loader
 */
interface Loader {
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

## VeliteFile

```ts
class VeliteFile extends VFile {
  /**
   * Get parsed records from file
   */
  get records(): unknown

  /**
   * Get content of file
   */
  get content(): string | undefined

  /**
   * Get mdast object from cache
   */
  get mdast(): Root | undefined

  /**
   * Get hast object from cache
   */
  get hast(): Nodes | undefined

  /**
   * Get plain text of content from cache
   */
  get plain(): string | undefined

  /**
   * Get loaded file object from cache
   * @param path file path
   * @returns loaded file object if exists
   */
  static get(path: string): VeliteFile | undefined

  /**
   * Create file object from file path
   * @param path file path
   * @param loaders file loaders
   * @returns loaded file object
   */
  static async create(path: string, loaders: Loader[]): Promise<VeliteFile>
}
```

## ParserContext

```ts
interface ParserContext {
  /**
   * Resolved config being used.
   */
  readonly config: Config

  /**
   * Current file being parsed.
   */
  readonly file: VeliteFile
}
```

Use [`context()`](./api.md#context) inside custom schema callbacks to access `ParserContext`.

## Context

```ts
type Context = {
  /**
   * Resolved config.
   */
  config: Config
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
