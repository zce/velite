// Record-scoped content derivation broker.
//
// The broker is the seam between schema-rooted projection requests and
// dialect-specific parsing/processing. It is created as part of the pipeline
// epoch, opened once for each record validation, and disposed when that
// record's asynchronous schema validation completes.
//
// The broker guarantees memoization and in-flight coalescing ONLY for matching
// pristine parses. The slot state machine is:
//   empty -> pending -> fulfilled | rejected
//   active broker -> disposed (terminal)
//
// Matching demands (same dialect, path, selected text, and effective parse
// profile) coalesce to exactly one pristine parse. Concurrent pending demands
// observe the same in-flight promise. A fulfilled slot retains the opaque
// PristineArtifact; a rejected slot retains the parse failure. Both terminal
// outcomes remain memoized until broker disposal; rejection is not retried
// within the record.
//
// Static projections (kind: 'mdast') read only the opaque pristine tree — no
// branch VFile, no returned transformers, no compilers. Transforming demands
// (kind: 'render-markdown' / 'compile-mdx') materialize an isolated branch
// (fresh tree + fresh VFile) and run the branch-specific processing/compilation
// pipeline on that branch VFile.
//
// Disposal is idempotent and terminal. It marks the broker disposed before
// clearing its slot index and retained artifacts. Late demand or
// materialization after disposal throws `VeliteError('internal')`.
//
// Internal — not exported from any public barrel.

import { processMarkdown } from '../../content/markdown'
import { processMdx } from '../../content/mdx'
import { fail } from '../../diagnostic'
import { createMarkdownAdapter, createMdxAdapter } from './adapter'
import { buildParseIdentity, parseIdentityKey } from './identity'

import type { Root as MdastRoot } from 'mdast'
import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../../content/markdown'
import type { ProcessMdxOptions } from '../../content/mdx'
import type { CompileMdxBranchOptions, ContentRequest, ProjectionKind, RenderMarkdownBranchOptions } from '../capability'
import type { ContentBranch, ContentDialectAdapter, DialectAdapterPair, OpaquePristineTree, PristineArtifact } from './adapter'
import type { ParseIdentity } from './identity'

/** The record scope a broker is opened for. */
export interface RecordScope {
  readonly recordId: string
  readonly sourcePath: string
  readonly cwd: string
}

/** A retained parse slot (pending | fulfilled | rejected). */
interface ParseSlot {
  readonly identity: ParseIdentity
  state: 'pending' | 'fulfilled' | 'rejected'
  promise: Promise<PristineArtifact>
  artifact?: PristineArtifact
  failure?: unknown
}

/** A retained branch (released after the branch settles). */
interface RetainedBranch {
  readonly branch: ContentBranch
}

/** Dependencies for the broker factory. */
export interface BrokerFactoryDeps {
  readonly adapters: DialectAdapterPair
}

/** The record-scoped broker. */
export interface RecordBroker {
  /** Demand a content derivation. Throws VeliteError('internal') after disposal. */
  demand(request: ContentRequest): Promise<unknown>
  /** Dispose the broker. Idempotent and terminal. Releases all retained state. */
  dispose(): void
  /** Test-only: inspect retained slot count (for disposal regression tests). */
  readonly retainedSlotCount: number
  /** Test-only: inspect retained branch count (for disposal regression tests). */
  readonly retainedBranchCount: number
}

/** The factory that opens a per-record broker. */
export interface ContentArtifactsFactory {
  open(scope: RecordScope): RecordBroker
}

/** Create the content artifacts factory for the pipeline composition root. */
export const createContentArtifactsFactory = (deps: BrokerFactoryDeps): ContentArtifactsFactory => ({
  open(scope: RecordScope): RecordBroker {
    const slots = new Map<string, ParseSlot>()
    const retainedBranches = new Set<RetainedBranch>()
    let disposed = false

    const ensureNotDisposed = (): void => {
      if (disposed) fail('internal', 'Record broker is disposed — late content demand after record close')
    }

    const adapterFor = (dialect: 'markdown' | 'mdx'): ContentDialectAdapter => (dialect === 'markdown' ? deps.adapters.markdown : deps.adapters.mdx)

    const parseIdentityOf = (request: ContentRequest): ParseIdentity => buildParseIdentity(request.dialect, request.path, request.text, request.profile)

    const obtainArtifact = async (request: ContentRequest): Promise<PristineArtifact> => {
      ensureNotDisposed()
      const identity = parseIdentityOf(request)
      const key = parseIdentityKey(identity)
      const existing = slots.get(key)
      if (existing !== undefined) {
        if (existing.state === 'fulfilled' && existing.artifact !== undefined) return existing.artifact
        if (existing.state === 'rejected' && existing.failure !== undefined) throw existing.failure
        return existing.promise
      }
      const adapter = adapterFor(request.dialect)
      const profile = request.profile as { gfm?: boolean; removeComments?: boolean; remarkPlugins?: PluggableList }
      const parseInput = {
        text: request.text,
        path: request.path,
        cwd: scope.cwd,
        gfm: profile?.gfm ?? true,
        removeComments: profile?.removeComments ?? true,
        remarkPlugins: (profile?.remarkPlugins ?? []) as PluggableList
      }
      const slot: ParseSlot = { identity, state: 'pending', promise: adapter.parse(parseInput) }
      slots.set(key, slot)
      try {
        const artifact = await slot.promise
        if (disposed) return artifact
        slot.artifact = artifact
        slot.state = 'fulfilled'
        return artifact
      } catch (err) {
        if (disposed) throw err
        slot.failure = err
        slot.state = 'rejected'
        throw err
      }
    }

    const readPristineTree = (artifact: PristineArtifact, dialect: 'markdown' | 'mdx'): OpaquePristineTree => adapterFor(dialect).readPristineTree(artifact)

    const materializeBranch = (artifact: PristineArtifact, dialect: 'markdown' | 'mdx'): ContentBranch => {
      ensureNotDisposed()
      const branch = adapterFor(dialect).materializeBranch(artifact)
      retainedBranches.add({ branch })
      return branch
    }

    const releaseBranch = (branch: ContentBranch): void => {
      for (const entry of retainedBranches) {
        if (entry.branch === branch) {
          retainedBranches.delete(entry)
          return
        }
      }
    }

    const runMarkdownRenderBranch = async (artifact: PristineArtifact, opts: RenderMarkdownBranchOptions): Promise<string> => {
      const branch = materializeBranch(artifact, 'markdown')
      const tree = branch.tree as unknown as MdastRoot
      const markdownOpts: MarkdownOptions = {
        gfm: opts.gfm,
        removeComments: opts.removeComments,
        remarkPlugins: opts.remarkPlugins as PluggableList,
        rehypePlugins: opts.rehypePlugins as PluggableList,
        processAsset: opts.processAsset,
        file: branch.file
      }
      try {
        return await processMarkdown(tree, markdownOpts)
      } finally {
        releaseBranch(branch)
      }
    }

    const runMdxCompileBranch = async (artifact: PristineArtifact, opts: CompileMdxBranchOptions): Promise<string> => {
      const branch = materializeBranch(artifact, 'mdx')
      const tree = branch.tree as unknown as MdastRoot
      const mdxOpts: ProcessMdxOptions = {
        gfm: opts.gfm,
        removeComments: opts.removeComments,
        minify: opts.minify,
        outputFormat: opts.outputFormat,
        development: opts.development,
        remarkPlugins: opts.remarkPlugins as PluggableList,
        rehypePlugins: opts.rehypePlugins as PluggableList,
        processAsset: opts.processAsset,
        path: opts.path,
        mdast: tree,
        file: branch.file
      }
      try {
        return await processMdx(artifact.text, mdxOpts)
      } finally {
        releaseBranch(branch)
      }
    }

    const broker: RecordBroker = {
      get retainedSlotCount(): number {
        return slots.size
      },
      get retainedBranchCount(): number {
        return retainedBranches.size
      },
      async demand(request: ContentRequest): Promise<unknown> {
        ensureNotDisposed()
        const artifact = await obtainArtifact(request)
        ensureNotDisposed()
        if (request.kind === 'mdast') {
          return readPristineTree(artifact, request.dialect)
        }
        if (request.kind === 'render-markdown') {
          return runMarkdownRenderBranch(artifact, request.branchOptions)
        }
        if (request.kind === 'compile-mdx') {
          return runMdxCompileBranch(artifact, request.branchOptions)
        }
        fail('internal', `Unknown content request kind: ${(request as { kind: string }).kind}`)
      },
      dispose(): void {
        if (disposed) return
        disposed = true
        slots.clear()
        retainedBranches.clear()
      }
    }
    return broker
  }
})

/** Default factory using the standard Markdown + MDX dialect adapters. */
export const createDefaultContentArtifactsFactory = (): ContentArtifactsFactory =>
  createContentArtifactsFactory({ adapters: { markdown: createMarkdownAdapter(), mdx: createMdxAdapter() } })

export { createMarkdownAdapter, createMdxAdapter }
export type { ContentDialectAdapter, DialectAdapterPair, PristineArtifact, ContentBranch, OpaquePristineTree }
export { buildParseIdentity, parseIdentityKey }
export type { ParseIdentity }
export type { ProjectionKind }
