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
   * Loader name
   * @description
   * The same name will overwrite the built-in loader,
   * built-in loaders: 'json', 'yaml', 'matter'
   */
  name: string
  /**
   * File test regexp
   * @example
   * /\.md$/
   */
  test: RegExp
  /**
   * Load file content
   * @param file vfile
   * @returns entry or entries
   */
  load: (file: VFile) => Promisable<Entry | Entry[]>
}
```

## VeliteFile

```ts
interface ZodMeta extends File {}

class File extends VFile {
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
   * Get meta object from cache
   * @param path file path
   * @returns resolved meta object if exists
   */
  static get(path: string): File | undefined

  /**
   * Create meta object from file path
   * @param options meta options
   * @returns resolved meta object
   */
  static async create({ path, config }: { path: string; config: Config }): Promise<File>
}
```

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
}
```

Refer to [MDX](https://mdxjs.com/packages/mdx/#compileoptions) for more information about `CompileOptions`.
