import { assetKeyOf } from '../../assets'
import { compareDiagnostic, diagnostic, fail, VeliteError } from '../../diagnostic'
import { builtinDeclarationContext } from '../../schema/effects'
import { dirname, join, stripQueryAndHash } from '../../util/path'
import { createMarkdownExecution } from './markdown'
import { createMdxExecution } from './mdx'
import { sourceExcerpt, sourceMetadata } from './source'

import type { Diagnostic } from '../../diagnostic'
import type { ContentFile, ContentRecord, ProjectInfo, SchemaContext } from '../../schema/context'
import type { EffectDeclarationContext, SchemaEffectDeclaration } from '../../schema/effects'
import type { SchemaContextHost } from '../../schema/host'
import type { NavigationSnapshot } from './navigation'
import type { ContentDefinitionDescriptor, ContentStageScope, MdxContentOptions, OwnedContent, SemanticContentRequest } from './types'

export interface ContentExecutionsDeps {
  host: SchemaContextHost
  markdown: typeof createMarkdownExecution
  mdx: typeof createMdxExecution
}

export interface ContentRecordScope {
  project: ProjectInfo
  file: ContentFile
  record: ContentRecord
  collection: { order: number; id: string }
  collectEffects(declarations: readonly ContentDeclaration[]): void
}

/** Internal atomic promotion batch, not an additional schema capability. */
export type ContentDeclaration = [SchemaEffectDeclaration, EffectDeclarationContext]

export interface RecordContent {
  demand(request: SemanticContentRequest): Promise<unknown>
  collectEffect: SchemaContext['collectEffect']
  diagnostics(): Diagnostic[]
  close(): void
}

export interface ContentExecutionsFactory {
  open(scope: ContentRecordScope): RecordContent
}

interface Execution {
  token: symbol
  owned?: OwnedContent
  source: string
  output?: string
  navigation?: NavigationSnapshot
  navigationRequested?: boolean
  stages: Partial<Record<'parse' | 'transform' | 'emit', { state: 'pending' | 'fulfilled' | 'rejected'; promise: Promise<void> }>>
}

/** Cached per-definition merged options plus the executions keyed by input text. */
interface DefinitionCache {
  options: MdxContentOptions
  inputs: Map<string, Execution>
}

/** One stage's effect journal: open while the stage runs, promoted on success. */
interface StageJournal {
  open: boolean
  declarations: ContentDeclaration[]
}

/**
 * The per-record mutable state owned by one `open()` scope: the definition
 * caches, stage journals, active-stage routing, and the private wait graph
 * (an actual stage-originating wait also covers executions started
 * independently before joining one another — it is only a cycle guard, not a
 * DAG API). Passed explicitly to every stage-lifecycle function so each is
 * module-level and independently navigable.
 */
interface RecordRun {
  readonly host: SchemaContextHost
  readonly scope: ContentRecordScope
  /** Dialect execution factories (the ContentExecutionsFactory deps). */
  readonly markdown: typeof createMarkdownExecution
  readonly mdx: typeof createMdxExecution
  readonly definitions: Map<ContentDefinitionDescriptor, DefinitionCache>
  readonly journals: Map<ContentStageScope, StageJournal>
  readonly activeStages: Map<symbol, ContentStageScope>
  readonly waits: Map<symbol, Map<Execution, Map<ContentStageScope['phase'], number>>>
  /** Rejects every in-flight demand when the record closes. */
  readonly terminal: Promise<never>
  rejectClosed: (error: VeliteError) => void
  closed: boolean
}

/** Rank used by the pending-demand recursion guard: later phases may not await themselves. */
const STAGE_RANK = { parse: 0, transform: 1, emit: 2 } as const

/**
 * Resolve a definition's effective options. Markdown and MDX share the
 * common fields (`MarkdownOptions`, from the matching global block); the
 * MDX-only compile fields always read the mdx global.
 */
const resolveContentOptions = (project: ProjectInfo, definition: ContentDefinitionDescriptor): MdxContentOptions => {
  const local = definition.options
  const common = definition.dialect === 'mdx' ? project.mdx : project.markdown
  const mdxGlobal = definition.dialect === 'mdx' ? project.mdx : undefined
  return {
    gfm: local.gfm ?? common?.gfm ?? true,
    removeComments: local.removeComments ?? common?.removeComments ?? true,
    copyLinkedFiles: local.copyLinkedFiles ?? common?.copyLinkedFiles ?? true,
    remarkPlugins: [...(local.remarkPlugins ?? []), ...(common?.remarkPlugins ?? [])],
    rehypePlugins: [...(local.rehypePlugins ?? []), ...(common?.rehypePlugins ?? [])],
    minify: local.minify ?? mdxGlobal?.minify ?? true,
    outputFormat: local.outputFormat ?? mdxGlobal?.outputFormat ?? 'function-body',
    development: local.development ?? mdxGlobal?.development ?? false,
    recmaPlugins: [...(local.recmaPlugins ?? []), ...(mdxGlobal?.recmaPlugins ?? [])]
  }
}

/** Resolve the currently open stage scope for an effect declaration or stage activity. */
const invocationStage = (run: RecordRun): ContentStageScope | undefined => {
  const origin = run.host.get().contentStage
  if (!origin || run.journals.get(origin)?.open) return origin
  // Async callbacks can inherit the attacher's Parse carrier. Route them
  // to this execution's actual invocation phase, never another execution.
  const current = run.activeStages.get(origin.execution)
  if (current && run.journals.get(current)?.open) return current
  fail('internal', 'Content stage scope is closed')
}

/** Lease/liveness gate every capability entry point funnels through; returns the open stage scope for effect routing. */
const activeStage = (run: RecordRun): ContentStageScope | undefined => {
  if (run.closed) fail('internal', 'Content record is closed')
  const carrier = run.host.get()
  if (!carrier.lease.active) fail('internal', 'Content schema run lease is inactive')
  return invocationStage(run)
}

/** Lease/liveness gate without effect routing. */
const active = (run: RecordRun): void => {
  activeStage(run)
}

/** Route one effect declaration into the open stage journal (or the record transaction). */
const declareEffect = (run: RecordRun, declaration: SchemaEffectDeclaration, context: EffectDeclarationContext): void => {
  const stage = activeStage(run)
  if (stage === undefined) {
    run.scope.collectEffects([[declaration, context]])
    return
  }
  const journal = run.journals.get(stage)
  if (!journal?.open) fail('internal', 'Content stage effect journal is closed')
  journal.declarations.push([declaration, context])
}

/** Obtain (create or reuse) the execution for one definition + input text. */
const obtainExecution = (run: RecordRun, request: SemanticContentRequest): Execution => {
  const { scope } = run
  let definition = run.definitions.get(request.definition)
  if (definition === undefined) {
    definition = { options: resolveContentOptions(scope.project, request.definition), inputs: new Map() }
    run.definitions.set(request.definition, definition)
  }
  let execution = definition.inputs.get(request.text)
  if (execution !== undefined) return execution
  const processAsset = definition.options.copyLinkedFiles
    ? async (url: string): Promise<string> => {
        active(run)
        const assetPath = join(dirname(scope.file.path), stripQueryAndHash(url))
        const template = scope.project.output.name
        const result = await run.host.get().publicContext.asset(assetKeyOf(assetPath, scope.project.root), { metadata: false })
        declareEffect(
          run,
          { type: 'asset', source: assetPath, output: { base: scope.project.output.base, template }, metadata: false },
          builtinDeclarationContext
        )
        return result.publicUrl
      }
    : undefined
  execution = {
    token: Symbol('execution'),
    source: '',
    stages: {},
    owned: (request.definition.dialect === 'mdx' ? run.mdx : run.markdown)({
      options: definition.options,
      path: scope.file.path,
      cwd: scope.project.root,
      text: request.text,
      processAsset
    })
  }
  definition.inputs.set(request.text, execution)
  return execution
}

/** Run one owned phase (parse / transform / emit) and capture its semantic result. */
const runOwnedPhase = async (run: RecordRun, execution: Execution, phase: 'parse' | 'transform' | 'emit'): Promise<void> => {
  if (phase === 'parse') {
    await execution.owned!.parse()
    active(run)
    execution.source = execution.owned!.sourceText()
  } else if (phase === 'transform') {
    await execution.owned!.transform()
    active(run)
    execution.navigation = execution.owned!.navigation()
  } else {
    const output = await execution.owned!.emit()
    active(run)
    execution.output = output
  }
}

/**
 * Demand one stage of one execution. Stages memoize on the execution; a
 * pending demand whose stage is an ancestor of the caller's is a recursive
 * wait and fails loudly. A stage's effect journal promotes (atomically, only
 * on success) through the record transaction when the stage settles.
 */
const runStage = (run: RecordRun, execution: Execution, phase: 'parse' | 'transform' | 'emit'): Promise<void> => {
  active(run)
  const existing = execution.stages[phase]
  if (existing !== undefined) {
    if (existing.state === 'pending')
      for (let ancestor = run.host.get().contentStage; ancestor !== undefined; ancestor = ancestor.parent) {
        if (ancestor.execution === execution.token && STAGE_RANK[phase] >= STAGE_RANK[ancestor.phase]) fail('internal', 'Recursive pending content demand')
      }
    return existing.promise
  }
  const stage: ContentStageScope = { token: Symbol(phase), execution: execution.token, phase, parent: run.host.get().contentStage }
  const journal: StageJournal = { open: true, declarations: [] }
  run.journals.set(stage, journal)
  const carrier = { ...run.host.get(), contentStage: stage }
  // The promise slot is assigned synchronously right below before any
  // caller can observe the stage, so the temporary `undefined` is never read.
  const outcome = { state: 'pending' as 'pending' | 'fulfilled' | 'rejected', promise: undefined as unknown as Promise<void> }
  execution.stages[phase] = outcome
  outcome.promise = Promise.resolve().then(async () => {
    if (phase !== 'parse') await runStage(run, execution, phase === 'transform' ? 'parse' : 'transform')
    active(run)
    return run.host.run(carrier, async () => {
      run.activeStages.set(execution.token, stage)
      try {
        active(run)
        await runOwnedPhase(run, execution, phase)
        active(run)
        journal.open = false
        run.scope.collectEffects(journal.declarations)
        outcome.state = 'fulfilled'
      } catch (error) {
        outcome.state = 'rejected'
        execution.owned?.close()
        throw error
      } finally {
        run.activeStages.delete(execution.token)
        journal.open = false
        journal.declarations.length = 0
      }
    })
  })
  void outcome.promise.catch(() => {
    outcome.state = 'rejected'
    journal.open = false
    journal.declarations.length = 0
  })
  return outcome.promise
}

/**
 * Track a stage-originating wait in the private wait graph and return its
 * release function. The graph detects waits that would recurse back into the
 * caller's own pending stage through independently started executions.
 */
const trackWait = (run: RecordRun, execution: Execution, phase: 'parse' | 'transform' | 'emit'): (() => void) | undefined => {
  const from = run.host.get().contentStage?.execution
  if (from === undefined) return
  const outcome = execution.stages[phase]
  if (outcome !== undefined && outcome.state !== 'pending') return
  const seen = new Set<symbol>()
  const reachesCaller = (token: symbol): boolean => {
    if (token === from) return true
    if (seen.has(token)) return false
    seen.add(token)
    for (const [target, phases] of run.waits.get(token) ?? [])
      for (const waitedPhase of phases.keys()) if (target.stages[waitedPhase]?.state === 'pending' && reachesCaller(target.token)) return true
    return false
  }
  if (reachesCaller(execution.token)) fail('internal', 'Recursive pending content demand')
  const targets = run.waits.get(from) ?? new Map<Execution, Map<ContentStageScope['phase'], number>>()
  const phases = targets.get(execution) ?? new Map<ContentStageScope['phase'], number>()
  phases.set(phase, (phases.get(phase) ?? 0) + 1)
  targets.set(execution, phases)
  run.waits.set(from, targets)
  return () => {
    if (run.closed) return
    const remaining = phases.get(phase)! - 1
    if (remaining) phases.set(phase, remaining)
    else phases.delete(phase)
    if (!phases.size) targets.delete(execution)
    if (!targets.size) run.waits.delete(from)
  }
}

/** Map a selection to the phase that produces it. */
const phaseOf = (selection: SemanticContentRequest['selection']): ContentStageScope['phase'] => {
  if (selection === 'html' || selection === 'code') return 'emit'
  if (selection === 'toc') return 'transform'
  return 'parse' // excerpt / metadata read only the parse-stage source text
}

/** One semantic content demand: run (or join) the required stage, return the selection. */
const demandContent = async (run: RecordRun, request: SemanticContentRequest): Promise<unknown> => {
  active(run)
  const execution = obtainExecution(run, request)
  if (request.selection === 'toc') execution.navigationRequested = true
  const phase = phaseOf(request.selection)
  const releaseWait = trackWait(run, execution, phase)
  try {
    await Promise.race([runStage(run, execution, phase), run.terminal])
  } catch (error) {
    active(run)
    throw error
  } finally {
    releaseWait?.()
  }
  active(run)
  if (request.selection === 'toc') {
    if (!execution.navigation) fail('internal', 'Completed content transform has no navigation snapshot')
    return execution.navigation.items.map(item => ({ ...item }))
  }
  if (request.selection === 'html' || request.selection === 'code') return execution.output
  if (request.selection === 'excerpt') return sourceExcerpt(execution.source, request.length)
  return sourceMetadata(execution.source)
}

/** Collect this record's non-fatal execution warnings as CONTENT_WARNING diagnostics. */
const collectWarnings = (run: RecordRun): Diagnostic[] => {
  if (run.closed) fail('internal', 'Content record is closed')
  const { scope } = run
  const result: Diagnostic[] = []
  for (const definition of run.definitions.values()) {
    for (const execution of definition.inputs.values()) {
      const warnings = [...(execution.owned?.messages() ?? [])]
      if (execution.navigationRequested) for (const reason of execution.navigation?.limitations ?? []) warnings.push({ reason })
      for (const message of warnings) {
        if (message.fatal) continue
        result.push(
          diagnostic('warn', 'CONTENT_WARNING', message.reason, {
            stage: 'schema',
            provenance: {
              scope: 'record',
              collection: scope.collection,
              source: { path: scope.file.id },
              record: { id: scope.record.id, index: scope.record.index }
            }
          })
        )
      }
    }
  }
  return result.sort(compareDiagnostic)
}

/** Close the record: reject in-flight demands, discard every execution and journal. */
const closeRecord = (run: RecordRun): void => {
  if (run.closed) return
  run.closed = true
  run.rejectClosed(new VeliteError('internal', { message: 'Content record is closed' }))
  for (const definition of run.definitions.values()) {
    for (const execution of definition.inputs.values()) {
      execution.owned?.close()
      execution.owned = undefined
      execution.source = ''
      execution.navigation = undefined
      execution.output = undefined
      execution.stages = {}
    }
  }
  for (const journal of run.journals.values()) {
    journal.open = false
    journal.declarations.length = 0
  }
  run.journals.clear()
  run.activeStages.clear()
  run.waits.clear()
  run.definitions.clear()
}

export const createContentExecutionsFactory = ({ host, markdown, mdx }: ContentExecutionsDeps): ContentExecutionsFactory => ({
  open(scope) {
    let rejectClosed!: (error: VeliteError) => void
    const terminal = new Promise<never>((_resolve, reject) => {
      rejectClosed = reject
    })
    void terminal.catch(() => {})
    const run: RecordRun = {
      host,
      scope,
      markdown,
      mdx,
      definitions: new Map(),
      journals: new Map(),
      activeStages: new Map(),
      waits: new Map(),
      terminal,
      rejectClosed,
      closed: false
    }
    return {
      collectEffect: (declaration, context) => declareEffect(run, declaration, context),
      demand: request => demandContent(run, request),
      diagnostics: () => collectWarnings(run),
      close: () => closeRecord(run)
    }
  }
})

export const createDefaultContentExecutionsFactory = (host: SchemaContextHost): ContentExecutionsFactory =>
  createContentExecutionsFactory({ host, markdown: createMarkdownExecution, mdx: createMdxExecution })
