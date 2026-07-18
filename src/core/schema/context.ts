// Schema execution context — the public eight-field view.
//
// Authority: Tickets 19, 21, 23. The exported `context()` returns only the
// eight-field public view. Velite-owned roots use one private leased
// record-bound content capability propagated through the process-owned
// SchemaContextHost. The public view and private carrier are different
// runtime objects. `Reflect.ownKeys(context())` exposes no carrier, lease,
// private capability, or private symbol.
//
// The process-owned `SchemaContextHost` (src/core/schema/host.ts) is the sole
// ambient architecture exception. The default Node runtime composition owns
// it for the process lifetime. It only propagates the current
// `SchemaRunContext` and rejects missing or inactive leased carriers. It owns
// no Builder, epoch, broker, generation, reader, publication, cache,
// registry, or lifecycle state.

// --- Internal test-facing compatibility shims (NOT public API) -------------
//
// These wrap the new process-owned SchemaContextHost + SchemaRunner so that
// source-internal unit tests using the pre-1.0 `installContextStorage` +
// `runWithContext` shape keep working during the Phase 1-3 migration. They are
// not exported from the root package, core barrel, or schema barrel's public
// type surface, and are removed once all tests migrate to `schemaRunner.run`.

import { fail } from '../diagnostic'
import { schemaContextHost } from './host'

import type { MarkdownOptions } from '../content/markdown'
import type { MdxOptions } from '../content/mdx'
import type { AssetResult, BlurOptions } from '../pipeline/asset'
import type { Effect, EffectDeclarationContext, SchemaEffectDeclaration } from './effects'

/**
 * A content file during schema parsing.
 *
 * `content` is the only body field; the pre-1.0 `mdast`, `hast`, and `plain`
 * derived fields are removed. Custom schemas that need parsing own their
 * parser; Velite-owned roots use the private record-bound content capability.
 */
export interface ContentFile {
  /** Stable source id (project-relative, POSIX). */
  readonly id: string
  /** Absolute source file path. */
  readonly path: string
  /** Raw text content (e.g. Markdown/MDX body), when available. */
  readonly content?: string
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
  /** Probe image metadata. `s.file()` and linked files only need the public URL. */
  metadata?: boolean
}

/**
 * Schema execution context — the eight-field public view.
 *
 * Available during schema parsing via `context()`. All eight fields are
 * accessible to both built-in and user-defined schemas; there is no
 * internal-only tier. The private record-bound content capability is a
 * separate runtime object reachable only by Velite-owned roots.
 */
export interface SchemaContext {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  /** Session-scoped store for advanced custom schemas (shared across rebuilds, reset on config reload). */
  readonly store: SessionStore
  /**
   * Declare a schema effect. The two-arg form `(effect: SchemaEffectDeclaration,
   * context: EffectDeclarationContext)` is the final 1.0 surface (Ticket 23).
   *
   * During the Phase 1-3 migration, the internal validate bridge also accepts
   * the legacy single-arg `Effect` shape so the existing `s.file`/`s.image`/
   * `s.unique`/asset-link builtins keep working; Phase 3 migrates every caller
   * to the two-arg form and removes the legacy overload. New code MUST use the
   * two-arg form.
   */
  readonly collectEffect: ((effect: SchemaEffectDeclaration, context: EffectDeclarationContext) => void) & ((effect: Effect) => void)
  /**
   * Resolve an asset by its key (content-root-relative POSIX source path,
   * i.e. relative to `project.root`). Demands the engine's asset derivation,
   * returning a memoized {@link AssetResult}. The returned `publicUrl` is
   * always available (derivable from the key); image metadata is zero until
   * the driver feeds the asset's bytes in pass 2.
   */
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  /**
   * Read an asset's bytes directly. Used by `s.image({ absoluteRoot })` to
   * resolve absolute paths that bypass the asset derivation pipeline.
   */
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  /**
   * Probe + blur an image's bytes directly, without going through the asset
   * derivation. Used by `s.image({ absoluteRoot })`.
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

/**
 * Session-scoped key/value store for advanced custom schemas.
 *
 * Belongs to the current build session: shared across rebuilds inside a watch
 * session, destroyed at the end of a one-shot build, and reset on config reload.
 * There is deliberately no `set()` — built-in cross-file schemas use the
 * internal effects model so concurrent validation stays deterministic. Use
 * {@link SchemaContext.store} when a custom schema needs lazily-initialised
 * shared state.
 */
export interface SessionStore {
  get<T>(key: string | symbol): T | undefined
  has(key: string | symbol): boolean
  getOrCreate<T>(key: string | symbol, create: () => T): T
}

/** Create a fresh session-scoped store (one per build session). Internal — reached via {@link SchemaContext.store}. */
export const createSessionStore = (): SessionStore => {
  const map = new Map<string | symbol, unknown>()
  return {
    get: <T>(key: string | symbol): T | undefined => map.get(key) as T | undefined,
    has: (key: string | symbol): boolean => map.has(key),
    getOrCreate: <T>(key: string | symbol, create: () => T): T => {
      if (map.has(key)) return map.get(key) as T
      const value = create()
      map.set(key, value)
      return value
    }
  }
}

/**
 * Get the eight-field public schema context for the current record parse.
 *
 * @throws `VeliteError('internal')` when called outside of a schema parse or
 *   after the active run has settled (late call).
 */
export const context = (): SchemaContext => {
  const carrier = schemaContextHost().get()
  if (!carrier.lease.active) fail('internal', 'Schema run lease is inactive — context() called after settlement')
  return carrier.publicContext
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

/** Create a content file with the given id, path, and optional body content. */
export const createContentFile = (id: string, path: string, content?: string): ContentFile => ({
  id,
  path,
  content
})
