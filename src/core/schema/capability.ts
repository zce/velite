// RecordContentCapability + ContentRequest — the narrow private record-bound
// content capability leased through the SchemaRunContext. Velite-owned roots
// and projections use exactly one controlled `content(request)` operation.
// Custom schemas receive no broker, pristine representation, request
// constructor, generic demand, projection protocol, or private branch state.
//
// Internal — not exported.

/** A static projection identifier (no transforming branch). */
export type ProjectionKind = 'toc' | 'excerpt' | 'metadata'

/** A transforming branch identifier (runs returned transformers + compilers). */
export type BranchKind = 'render-markdown' | 'compile-mdx'

/** Common fields shared by every content request. */
interface ContentRequestBase {
  readonly text: string
  readonly path: string
  readonly dialect: 'markdown' | 'mdx'
  /** The effective parse profile for the current record parse. */
  readonly profile: unknown
}

/** A static-projection request: returns the opaque pristine mdast tree. */
export interface MdastRequest extends ContentRequestBase {
  readonly kind: 'mdast'
  readonly projection?: ProjectionKind
  readonly options?: unknown
}

/** Options for a Markdown render branch. */
export interface RenderMarkdownBranchOptions {
  readonly gfm: boolean
  readonly removeComments: boolean
  readonly remarkPlugins: readonly unknown[]
  readonly rehypePlugins: readonly unknown[]
  readonly processAsset?: (url: string) => Promise<string>
}

/** Options for an MDX compile branch. */
export interface CompileMdxBranchOptions {
  readonly gfm: boolean
  readonly removeComments: boolean
  readonly minify: boolean
  readonly outputFormat: 'program' | 'function-body'
  readonly development: boolean
  readonly remarkPlugins: readonly unknown[]
  readonly rehypePlugins: readonly unknown[]
  readonly processAsset?: (url: string) => Promise<string>
  readonly path?: string
}

/** A transforming-branch request: materializes an isolated branch and runs the branch pipeline. */
export interface RenderMarkdownRequest extends ContentRequestBase {
  readonly kind: 'render-markdown'
  readonly branchOptions: RenderMarkdownBranchOptions
}

/** A transforming-branch request for MDX compilation. */
export interface CompileMdxRequest extends ContentRequestBase {
  readonly kind: 'compile-mdx'
  readonly branchOptions: CompileMdxBranchOptions
}

/** A content request descriptor carried by the private capability. Internal. */
export type ContentRequest = MdastRequest | RenderMarkdownRequest | CompileMdxRequest

/** A narrow record-bound content capability. Internal — not exported. */
export interface RecordContentCapability {
  /**
   * Demand a content derivation for the current record. The carried operation
   * checks the same lease on every invocation before delegating to the record
   * broker. Throws `VeliteError('internal')` after lease closure.
   *
   * For `kind: 'mdast'`, returns the opaque pristine mdast tree (static
   * projections read it directly). For a transforming branch, returns the
   * compiled string (Markdown HTML or MDX function-body).
   */
  content(request: ContentRequest): Promise<unknown>
}
