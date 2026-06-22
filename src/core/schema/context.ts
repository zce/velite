// Schema execution context.
//
// The context is the bridge between the pipeline (which knows the current file,
// record and project) and schemas (built-in and user-defined), which need that
// ambient information during a parse. It is propagated through async zod
// transforms via `AsyncLocalStorage`, so a schema calls `context()` and gets the
// state for the record currently being parsed.
//
// Adapted from the pre-refactor `src/schemas/context.ts` for the new arch:
// - the asset capability is a single `asset(assetKey)` closure (M5): it demands
//   the engine's asset derivation, returning a memoized `AssetResult`. The
//   closure is built by the validate derivation, which has engine access;
// - `collectEffect` is kept (effects are accumulated in M4, fully wired in M6);
// - `ProjectInfo` is a read-only snapshot built from `ResolvedConfig` by the
//   validate derivation (no import of `ResolvedConfig` here, to avoid a cycle:
//   config -> schema/s -> builtins -> context).

import { AsyncLocalStorage } from 'node:async_hooks'
import { raw as hastRaw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

import { fail } from '../diagnostic'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { MarkdownOptions } from '../content/markdown'
import type { MdxOptions } from '../content/mdx'
import type { AssetResult, BlurOptions } from '../pipeline/asset'
import type { Effect } from './effects'

/**
 * A content file during schema parsing.
 *
 * AST fields (`mdast`, `hast`, `plain`) are lazily computed on first access
 * from `content` and cached. They are not part of the stable 1.0 type contract
 * but are accessible at runtime for advanced use cases.
 */
export interface ContentFile {
  /** Stable source id (project-relative, POSIX). */
  readonly id: string
  /** Absolute source file path. */
  readonly path: string
  /** Raw text content (e.g. Markdown/MDX body), when available. */
  readonly content?: string
  /** Plain text extracted from content, when available. */
  readonly plain?: string
  /** Lazily-parsed Markdown AST, when content is available. */
  readonly mdast?: Root
  /** Lazily-parsed HTML AST, when content is available. */
  readonly hast?: Nodes
}

/** Identity of the record currently being parsed within a multi-record source. */
export interface ContentRecord {
  /** Stable record id (`sourceId#key`). */
  readonly id: string
  /** Loader-provided record key, when available. */
  readonly key?: string
  /** Record index within its source. */
  readonly index: number
}

/** Read-only, per-collection view exposed through the schema context. */
export interface ProjectCollectionInfo {
  /** Glob include patterns (relative to the content root). */
  readonly pattern: readonly string[]
  /** Single-item output (one entry) instead of a list. */
  readonly single: boolean
  /** Per-entry schema. */
  readonly schema: unknown
}

/** Stable, public view of the resolved project. */
export interface ProjectInfo {
  readonly root: string
  readonly configPath: string
  readonly collections: Readonly<Record<string, ProjectCollectionInfo>>
  readonly output: { readonly data: string; readonly assets: string; readonly base: string; readonly name: string }
  readonly markdown?: MarkdownOptions
  readonly mdx?: MdxOptions
}

/** Options passed when resolving an asset. */
export interface AssetRequest {
  /** Override the global `output.name` template for this asset. */
  template?: string
  /** Override the global blur dimensions/quality. */
  blur?: BlurOptions
}

/**
 * Schema execution context.
 *
 * Available during schema parsing via `context()`. All fields are accessible
 * to both built-in and user-defined schemas — there is no internal-only tier.
 */
export interface SchemaContext {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  /** Declare a schema effect (unique registration, asset reference, etc.). */
  readonly collectEffect: (effect: Effect) => void
  /**
   * Resolve an asset by its key (project-root-relative source path). Demands the
   * engine's asset derivation, returning a memoized {@link AssetResult}. The
   * returned `publicUrl` is always available (derivable from the key); image
   * metadata is zero until the driver feeds the asset's bytes in pass 2.
   *
   * `request.template` lets a single schema invocation pick a different
   * filename template than the global `project.output.name`. `request.blur`
   * customises the generated placeholder.
   */
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  /**
   * Read an asset's bytes directly. Used by `s.image({ absoluteRoot })` to
   * resolve absolute paths that bypass the asset derivation pipeline. The
   * implementation closes over the runtime's filesystem so the schema layer
   * stays runtime-agnostic.
   */
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  /**
   * Probe + blur an image's bytes directly, without going through the asset
   * derivation. Used by `s.image({ absoluteRoot })` because those paths never
   * become hashed asset outputs. Returns metadata-rich {@link AssetResult}-ish
   * tuple; the public url is the caller's responsibility (it is the verbatim
   * input value for absolute paths).
   */
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}

/** Metadata returned by {@link SchemaContext.probeImage}. */
export interface ImageMetadata {
  width: number
  height: number
  format: string
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}

export interface RunWithContextInput {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly collectEffect: (effect: Effect) => void
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
}

const als = new AsyncLocalStorage<SchemaContext>()

const MISSING = 'Missing schema context — are you calling context() outside of a schema parse?'

/**
 * Get the schema context for the current record parse.
 *
 * @throws `VeliteError` (`internal`) when called outside of a schema parse.
 */
export const context = (): SchemaContext => {
  const ctx = als.getStore()
  if (ctx == null) fail('internal', MISSING)
  return ctx
}

/** Run `run` inside a schema context for a single record parse. */
export const runWithContext = <R>(input: RunWithContextInput, run: () => R): R => {
  const ctx: SchemaContext = {
    project: input.project,
    file: input.file,
    record: input.record,
    collectEffect: input.collectEffect,
    asset: input.asset,
    readFile: input.readFile,
    probeImage: input.probeImage
  }
  return als.run(ctx, run)
}

/**
 * Create a schema-context content file with lazily-parsed AST.
 *
 * `mdast`, `hast` and `plain` are derived on first access from `content` and
 * cached. All schemas (built-in and user-defined) access them via `context()`.
 *
 * Ported from the pre-refactor `src/collections/file.ts` `createContentFile`.
 */
export const createContentFile = (id: string, path: string, content?: string): ContentFile => {
  let mdastCache: Root | undefined
  let hastCache: Nodes | undefined
  let plainCache: string | undefined

  const file: ContentFile = {
    id,
    path,
    content,
    get mdast(): Root | undefined {
      if (mdastCache != null) return mdastCache
      if (content == null) return undefined
      mdastCache = Object.freeze(fromMarkdown(content))
      return mdastCache
    },
    get hast(): Nodes | undefined {
      if (hastCache != null) return hastCache
      const mdast = this.mdast
      if (mdast == null) return undefined
      hastCache = Object.freeze(hastRaw(toHast(mdast, { allowDangerousHtml: true })))
      return hastCache
    },
    get plain(): string | undefined {
      if (plainCache != null) return plainCache
      const hast = this.hast
      if (hast == null) return undefined
      plainCache = toString(hast)
      return plainCache
    }
  }
  return file
}

/**
 * Resolve the body content for a raw entry.
 *
 * The built-in matter loader attaches the body to `data.content`; custom loaders
 * may instead attach it to `item.meta.content` (surfaced as `raw.meta.content`).
 * This helper accepts both, preferring an explicit `meta.content` when present.
 */
export const resolveBody = (data: unknown, meta?: Record<string, unknown>): string | undefined => {
  const fromMeta = meta?.content
  if (typeof fromMeta === 'string') return fromMeta
  if (data != null && typeof data === 'object' && 'content' in data) {
    const candidate = (data as { content?: unknown }).content
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}
