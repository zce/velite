import { compareDiagnostic, diagnostic, fail, VeliteError } from '../../diagnostic'
import { assetKeyOf } from '../../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../../util/path'
import { createMarkdownExecution } from './markdown'
import { createMdxExecution } from './mdx'
import { sourceExcerpt, sourceMetadata } from './source'

import type { Diagnostic } from '../../diagnostic'
import type { ContentFile, ContentRecord, ProjectInfo, SchemaContext } from '../../schema/context'
import type { Effect, EffectDeclarationContext, SchemaEffectDeclaration } from '../../schema/effects'
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
export type ContentDeclaration = [Effect] | [SchemaEffectDeclaration, EffectDeclarationContext]

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

export const createContentExecutionsFactory = ({ host, markdown, mdx }: ContentExecutionsDeps): ContentExecutionsFactory => ({
  open(scope) {
    const definitions = new Map<ContentDefinitionDescriptor, { options: MdxContentOptions; inputs: Map<string, Execution> }>()
    const journals = new Map<ContentStageScope, { open: boolean; declarations: ContentDeclaration[] }>()
    const activeStages = new Map<symbol, ContentStageScope>()
    // Actual stage-originating waits also cover executions started independently
    // before joining one another. This is only a private cycle guard, not a DAG API.
    const waits = new Map<symbol, Map<Execution, Map<ContentStageScope['phase'], number>>>()
    let closed = false
    let rejectClosed!: (error: VeliteError) => void
    const terminal = new Promise<never>((_resolve, reject) => {
      rejectClosed = reject
    })
    void terminal.catch(() => {})
    const invocationStage = (): ContentStageScope | undefined => {
      const origin = host.get().contentStage
      if (!origin || journals.get(origin)?.open) return origin
      // Async callbacks can inherit the attacher's Parse carrier. Route them
      // to this execution's actual invocation phase, never another execution.
      const current = activeStages.get(origin.execution)
      if (current && journals.get(current)?.open) return current
      fail('internal', 'Content stage scope is closed')
    }
    const active = (): void => {
      if (closed) fail('internal', 'Content record is closed')
      const carrier = host.get()
      if (!carrier.lease.active) fail('internal', 'Content schema run lease is inactive')
      invocationStage()
    }
    const collectEffect: SchemaContext['collectEffect'] = (...args: ContentDeclaration) => {
      active()
      const stage = invocationStage()
      if (stage === undefined) {
        scope.collectEffects([args])
        return
      }
      const journal = journals.get(stage)
      if (!journal?.open) fail('internal', 'Content stage effect journal is closed')
      journal.declarations.push(args)
    }
    const obtain = (request: SemanticContentRequest): Execution => {
      let definition = definitions.get(request.definition)
      if (definition === undefined) {
        const local = request.definition.options
        const global = request.definition.dialect === 'mdx' ? scope.project.mdx : scope.project.markdown
        const mdxGlobal = request.definition.dialect === 'mdx' ? scope.project.mdx : undefined
        const options: MdxContentOptions = {
          gfm: local.gfm ?? global?.gfm ?? true,
          removeComments: local.removeComments ?? global?.removeComments ?? true,
          copyLinkedFiles: local.copyLinkedFiles ?? global?.copyLinkedFiles ?? true,
          remarkPlugins: [...(local.remarkPlugins ?? []), ...(global?.remarkPlugins ?? [])],
          rehypePlugins: [...(local.rehypePlugins ?? []), ...(global?.rehypePlugins ?? [])],
          minify: local.minify ?? mdxGlobal?.minify ?? true,
          outputFormat: local.outputFormat ?? mdxGlobal?.outputFormat ?? 'function-body',
          development: local.development ?? mdxGlobal?.development ?? false,
          recmaPlugins: [...(local.recmaPlugins ?? []), ...(mdxGlobal?.recmaPlugins ?? [])]
        }
        definition = { options, inputs: new Map() }
        definitions.set(request.definition, definition)
      }
      let execution = definition.inputs.get(request.text)
      if (execution === undefined) {
        const processAsset = definition.options.copyLinkedFiles
          ? async (url: string): Promise<string> => {
              active()
              const assetPath = join(dirname(scope.file.path), stripQueryAndHash(url))
              const result = await host.get().publicContext.asset(assetKeyOf(assetPath, scope.project.root), { metadata: false })
              collectEffect({ type: 'asset', owner: scope.record.id, assetPath, publicUrl: result.publicUrl, resolved: result.resolved, isImage: false })
              return result.publicUrl
            }
          : undefined
        execution = {
          token: Symbol('execution'),
          source: '',
          stages: {},
          owned: (request.definition.dialect === 'mdx' ? mdx : markdown)({
            options: definition.options,
            path: scope.file.path,
            cwd: scope.project.root,
            text: request.text,
            processAsset
          })
        }
        definition.inputs.set(request.text, execution)
      }
      return execution
    }
    const runStage = (execution: Execution, phase: 'parse' | 'transform' | 'emit'): Promise<void> => {
      active()
      const existing = execution.stages[phase]
      if (existing !== undefined) {
        if (existing.state === 'pending')
          for (let ancestor = host.get().contentStage; ancestor !== undefined; ancestor = ancestor.parent) {
            const rank = { parse: 0, transform: 1, emit: 2 }
            if (ancestor.execution === execution.token && rank[phase] >= rank[ancestor.phase]) fail('internal', 'Recursive pending content demand')
          }
        return existing.promise
      }
      const stage: ContentStageScope = { token: Symbol(phase), execution: execution.token, phase, parent: host.get().contentStage }
      const journal = { open: true, declarations: [] as ContentDeclaration[] }
      journals.set(stage, journal)
      const carrier = { ...host.get(), contentStage: stage }
      // The promise slot is assigned synchronously right below before any
      // caller can observe the stage, so the temporary `undefined` is never read.
      const outcome = { state: 'pending' as 'pending' | 'fulfilled' | 'rejected', promise: undefined as unknown as Promise<void> }
      execution.stages[phase] = outcome
      outcome.promise = Promise.resolve().then(async () => {
        if (phase !== 'parse') await runStage(execution, phase === 'transform' ? 'parse' : 'transform')
        active()
        return host.run(carrier, async () => {
          activeStages.set(execution.token, stage)
          try {
            active()
            if (phase === 'parse') {
              await execution.owned!.parse()
              active()
              execution.source = execution.owned!.sourceText()
            } else if (phase === 'transform') {
              await execution.owned!.transform()
              active()
              execution.navigation = execution.owned!.navigation()
            } else {
              const output = await execution.owned!.emit()
              active()
              execution.output = output
            }
            active()
            journal.open = false
            scope.collectEffects(journal.declarations)
            outcome.state = 'fulfilled'
          } catch (error) {
            outcome.state = 'rejected'
            execution.owned?.close()
            throw error
          } finally {
            activeStages.delete(execution.token)
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
    const trackWait = (execution: Execution, phase: 'parse' | 'transform' | 'emit'): (() => void) | undefined => {
      const from = host.get().contentStage?.execution
      if (!from || (execution.stages[phase] && execution.stages[phase]!.state !== 'pending')) return
      const seen = new Set<symbol>()
      const reachesCaller = (token: symbol): boolean => {
        if (token === from) return true
        if (seen.has(token)) return false
        seen.add(token)
        for (const [target, phases] of waits.get(token) ?? [])
          for (const phase of phases.keys()) if (target.stages[phase]?.state === 'pending' && reachesCaller(target.token)) return true
        return false
      }
      if (reachesCaller(execution.token)) fail('internal', 'Recursive pending content demand')
      const targets = waits.get(from) ?? new Map<Execution, Map<ContentStageScope['phase'], number>>()
      const phases = targets.get(execution) ?? new Map<ContentStageScope['phase'], number>()
      phases.set(phase, (phases.get(phase) ?? 0) + 1)
      targets.set(execution, phases)
      waits.set(from, targets)
      return () => {
        if (closed) return
        const remaining = phases.get(phase)! - 1
        if (remaining) phases.set(phase, remaining)
        else phases.delete(phase)
        if (!phases.size) targets.delete(execution)
        if (!targets.size) waits.delete(from)
      }
    }
    return {
      collectEffect,
      async demand(request) {
        active()
        const execution = obtain(request)
        if (request.selection === 'toc') execution.navigationRequested = true
        const phase = request.selection === 'html' || request.selection === 'code' ? 'emit' : request.selection === 'toc' ? 'transform' : 'parse'
        const releaseWait = trackWait(execution, phase)
        try {
          await Promise.race([runStage(execution, phase), terminal])
        } catch (error) {
          active()
          throw error
        } finally {
          releaseWait?.()
        }
        active()
        if (request.selection === 'toc') {
          if (!execution.navigation) fail('internal', 'Completed content transform has no navigation snapshot')
          return execution.navigation.items.map(item => ({ ...item }))
        }
        return request.selection === 'html' || request.selection === 'code'
          ? execution.output
          : request.selection === 'excerpt'
            ? sourceExcerpt(execution.source, request.length)
            : sourceMetadata(execution.source)
      },
      diagnostics() {
        if (closed) fail('internal', 'Content record is closed')
        const result: Diagnostic[] = []
        for (const definition of definitions.values())
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
        return result.sort(compareDiagnostic)
      },
      close() {
        if (closed) return
        closed = true
        rejectClosed(new VeliteError('internal', { message: 'Content record is closed' }))
        for (const definition of definitions.values())
          for (const execution of definition.inputs.values()) {
            execution.owned?.close()
            execution.owned = undefined
            execution.source = ''
            execution.navigation = undefined
            execution.output = undefined
            execution.stages = {}
          }
        for (const journal of journals.values()) {
          journal.open = false
          journal.declarations.length = 0
        }
        journals.clear()
        activeStages.clear()
        waits.clear()
        definitions.clear()
      }
    }
  }
})

export const createDefaultContentExecutionsFactory = (host: SchemaContextHost): ContentExecutionsFactory =>
  createContentExecutionsFactory({ host, markdown: createMarkdownExecution, mdx: createMdxExecution })
