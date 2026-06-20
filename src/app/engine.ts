import { mkdir, rm } from 'node:fs/promises'
import { normalize } from 'node:path'

import { createAssetStore } from '../assets/store'
import { collectionAffected, discover as defaultDiscover } from '../collections/discover'
import { createContentFile } from '../collections/file'
import { createConfigLoader } from '../config/load'
import { createDiagnostic, hasFatalDiagnostic, VeliteError } from '../core/diagnostics'
import { createRecordId, createSourceId } from '../core/ids'
import { applyPrepare, runBuild } from '../core/pipeline'
import { createSession } from '../core/session'
import { planEntry, planSingleCollection, planSplitCollectionEntry, planSplitOutput, planTypes } from '../output/plan'
import { createWriter } from '../output/write'
import { createLogger, logger as defaultLogger } from '../runtime/logger'
import { runWithContext } from '../schemas/context'

import type { AssetStore } from '../assets/store'
import type { BuildResult, Collection, Collections } from '../collections'
import type { ConfigLoader, LoadOptions } from '../config/load'
import type { Diagnostic } from '../core/diagnostics'
import type { GraphEdge } from '../core/graph'
import type { BuildRunResult } from '../core/pipeline'
import type { Project } from '../core/project'
import type { Session } from '../core/session'
import type { OutputWrite, RecordInput } from '../output/plan'
import type { Writer } from '../output/write'
import type { Logger, LogLevel } from '../runtime/logger'
import type { AssetReferenceEffect, Effect, SourceDependencyEffect } from '../schemas/effects'

/** Build options for `build()` / `watch()`. */
export interface BuildOptions {
  /** Config file path (relative to cwd). Auto-discovered when omitted. */
  config?: string
  /** Clean output directories before build. @default false */
  clean?: boolean
  /** Throw on any schema validation failure. @default false */
  strict?: boolean
  /** Log level. @default 'info' */
  logLevel?: LogLevel
  /** Inject a custom logger (framework integrations / tests). */
  logger?: Logger
  /** Working directory for embedded calls. @default process.cwd() */
  cwd?: string
  /** Abort the in-flight build run. Aborted runs never commit state. */
  signal?: AbortSignal
}

/** A parsed record ready for aggregation and output planning. */
interface ParsedRecord {
  readonly id: string
  readonly data: unknown
  readonly sourceId: string
}

export interface EngineOptions {
  loader?: ConfigLoader
  writer?: Writer
  logger?: Logger
  discover?: typeof defaultDiscover
}

/**
 * Build engine: orchestrates config → session → execute → commit.
 *
 * The engine owns the config loader, the current project/session, and the
 * engine-scoped parsed-records cache reused across watch rebuilds. It does not
 * hold hidden business state beyond these explicit containers.
 */
export interface Engine {
  build(options?: BuildOptions): Promise<BuildResult>
  rebuild(change?: RebuildChange): Promise<BuildResult>
  readonly config: Project | undefined
  /** Diagnostics from the most recent build run. */
  readonly diagnostics: readonly Diagnostic[]
  hasAssetSource(path: string): boolean
  invalidateAssetSource(path: string): string[]
}

export type RebuildEvent = 'add' | 'change' | 'unlink'

export interface RebuildChange {
  readonly event: RebuildEvent
  readonly paths: readonly string[]
}

interface ParsedCache {
  // collectionKey -> parsed records (ordered)
  records: Map<string, ParsedRecord[]>
  // collectionKey -> discovered absolute source paths
  sources: Map<string, string[]>
}

const createParsedCache = (): ParsedCache => ({ records: new Map(), sources: new Map() })

export const createEngine = (options: EngineOptions = {}): Engine => {
  const configLoader = options.loader ?? createConfigLoader({ logger: options.logger ?? defaultLogger })
  const discover = options.discover ?? defaultDiscover
  let writer: Writer = options.writer ?? createWriter({ logger: options.logger ?? defaultLogger })
  let logger: Logger & { set?(level: LogLevel): void } = (options.logger as Logger & { set?(level: LogLevel): void }) ?? createLogger('info')

  let currentProject: Project | undefined
  let currentOptions: BuildOptions = {}
  let currentSession: Session | undefined
  let parsed = createParsedCache()
  const outputState = { emitted: new Map<string, string>() }

  const resolveLogger = (opts: BuildOptions): Logger => {
    if (opts.logger != null) return opts.logger
    return logger
  }

  const parseCollection = async (
    project: Project,
    collectionKey: string,
    collection: Collection,
    log: Logger,
    files: Session['files'],
    assetStore: AssetStore,
    assetCache: Session['assetCache'],
    store: Session['store'],
    collectEffect: (e: Effect) => void
  ): Promise<{ records: ParsedRecord[]; diagnostics: Diagnostic[]; sourcePaths: string[] }> => {
    const paths = await discover(project.root, collection.pattern)
    const records: ParsedRecord[] = []
    const diagnostics: Diagnostic[] = []

    for (const path of paths) {
      const sourceId = createSourceId(path, project.root)
      let loaded
      try {
        loaded = await files.load(path, project.loaders, sourceId)
      } catch (err) {
        diagnostics.push(
          createDiagnostic({
            severity: 'error',
            code: 'loader.failed',
            message: err instanceof Error ? err.message : String(err),
            file: path,
            collection: collectionKey,
            stage: 'load'
          })
        )
        continue
      }

      for (const dependency of loaded.dependencies) {
        collectEffect({ type: 'dependency', owner: sourceId, sourceId: createSourceId(dependency, project.root) })
      }

      const isMulti = loaded.records.length > 1
      for (let index = 0; index < loaded.records.length; index++) {
        const raw = loaded.records[index]
        const recordKey = raw.key ?? (isMulti ? String(index) : undefined)
        const recordId = createRecordId(sourceId, recordKey)
        const file = createContentFile(sourceId, path, raw.content)

        let parseResult
        try {
          parseResult = await runWithContext(
            { project, file, record: { id: recordId, key: recordKey, index }, store, assetCache, assetStore, collectEffect },
            () => collection.schema.safeParseAsync(raw.data)
          )
        } catch (err) {
          // Defensive catch: Zod's safeParseAsync should swallow transform
          // errors, but if an unexpected throw escapes (e.g. a non-Zod error
          // in a custom schema's .transform), report it as a schema diagnostic
          // rather than crashing the entire build run.
          diagnostics.push(
            createDiagnostic({
              severity: 'error',
              code: 'schema.exception',
              message: err instanceof Error ? err.message : String(err),
              file: path,
              collection: collectionKey,
              recordId,
              stage: 'schema',
              cause: err
            })
          )
          continue
        }

        if (parseResult.success) {
          records.push({ id: recordId, data: parseResult.data, sourceId })
          continue
        }

        for (const issue of parseResult.error.issues) {
          diagnostics.push(
            createDiagnostic({
              severity: 'error',
              code: 'schema.invalid',
              message: issue.message ?? 'Validation error',
              file: path,
              collection: collectionKey,
              recordId,
              path: issue.path as Array<string | number> | undefined,
              stage: 'schema'
            })
          )
        }
      }
    }

    log.debug?.(`parsed ${records.length} records for '${collectionKey}'`)
    return { records, diagnostics, sourcePaths: paths }
  }

  const aggregateResult = (project: Project, parsedCache: ParsedCache, diagnostics: Diagnostic[]): BuildResult => {
    const result: Record<string, unknown> = {}
    for (const [key, collection] of Object.entries(project.collections)) {
      const records = parsedCache.records.get(key) ?? []
      const data = records.map(r => r.data)
      if (collection.single) {
        if (data.length === 0) {
          diagnostics.push(
            createDiagnostic({
              severity: 'error',
              code: 'collection.empty',
              message: `no records resolved for single collection '${key}'`,
              collection: key,
              stage: 'schema'
            })
          )
          result[key] = undefined
        } else {
          if (data.length > 1) {
            diagnostics.push(
              createDiagnostic({
                severity: 'warning',
                code: 'collection.multiple',
                message: `resolved ${data.length} records for single collection '${key}', using the first`,
                collection: key,
                stage: 'schema'
              })
            )
          }
          result[key] = data[0]
        }
      } else {
        result[key] = data
      }
    }
    return result as BuildResult
  }

  const buildGraphEdges = (
    project: Project,
    parsedCache: ParsedCache,
    assetEffects: readonly { owner: string; assetPath: string }[],
    dependencyEffects: readonly { owner: string; sourceId: string }[]
  ): GraphEdge[] => {
    const edges: GraphEdge[] = []
    const configNode = 'config'
    for (const key of Object.keys(project.collections)) {
      edges.push({ from: configNode, to: `collection:${key}`, reason: 'config-affects-collection' })
      const collectionNode = `collection:${key}`
      const records = parsedCache.records.get(key) ?? []
      for (const record of records) {
        const sourceNode = `source:${record.sourceId}`
        const recordNode = `record:${record.id}`
        edges.push({ from: collectionNode, to: sourceNode, reason: 'collection-matches-source' })
        edges.push({ from: sourceNode, to: recordNode, reason: 'source-produces-record' })
        edges.push({ from: recordNode, to: `output:${key}/${record.id}`, reason: 'record-produces-output' })
      }
    }
    for (const asset of assetEffects) {
      edges.push({ from: `record:${asset.owner}`, to: `asset:${asset.assetPath}`, reason: 'record-references-asset' })
    }
    for (const dep of dependencyEffects) {
      edges.push({ from: `source:${dep.sourceId}`, to: `source:${dep.owner}`, reason: 'loader-depends-on-source' })
    }
    return edges
  }

  const planWrites = (project: Project, parsedCache: ParsedCache, result: BuildResult, split: boolean): OutputWrite[] => {
    const writes: OutputWrite[] = []
    const collections = project.collections
    for (const key of Object.keys(collections)) {
      const collection = collections[key]
      const records = parsedCache.records.get(key) ?? []
      // The record file content must reflect the (possibly prepare-mutated or
      // replaced) logical result, not the raw pre-prepare parsed data. Align by
      // index against the parsed record ids so stable physical paths are kept.
      const collectionValue = result[key]
      const dataArray: unknown[] = collection.single
        ? collectionValue == null
          ? []
          : [collectionValue]
        : Array.isArray(collectionValue)
          ? collectionValue
          : []
      if (split) {
        const recordInputs: RecordInput[] = records.map((record, index) => ({
          id: record.id,
          data: index < dataArray.length ? dataArray[index] : record.data
        }))
        const splitResult = planSplitOutput(key, recordInputs)
        writes.push(...splitResult.writes)
        writes.push(
          planSplitCollectionEntry(
            key,
            collection,
            splitResult.writes.map(w => w.path)
          )
        )
      } else {
        writes.push(planSingleCollection(key, collectionValue))
      }
    }
    writes.push(planEntry(collections, project.output.format, split))
    writes.push(planTypes(collections, project.configPath, project.output.data))
    return writes
  }

  const execute = async (
    session: Session,
    project: Project,
    options: BuildOptions,
    change: RebuildChange | undefined,
    split: boolean,
    log: Logger
  ): Promise<BuildRunResult> => {
    const collectedEffects: Effect[] = []
    const assetStore = createAssetStore()
    const diagnostics: Diagnostic[] = []
    // Read fresh on each check so a signal aborted mid-run is observed; wrapped
    // in a closure so the type checker does not narrow it across statements.
    const aborted = () => options.signal?.aborted === true

    // An aborted run never commits: if the caller already signalled abort, fail
    // immediately without touching any candidate state.
    if (aborted()) {
      return { status: 'failure', diagnostics: [createDiagnostic({ severity: 'error', code: 'aborted', message: 'build aborted', stage: 'output' })] }
    }

    const affectedKeys =
      change == null
        ? Object.keys(project.collections)
        : Object.keys(project.collections).filter(key =>
            collectionAffected(project.root, project.collections[key].pattern, new Set(change.paths.map(normalize)))
          )

    // capture old record ids of affected collections (for effect patch removal)
    const affectedOwners: string[] = []
    if (change != null) {
      for (const key of affectedKeys) {
        const old = parsed.records.get(key) ?? []
        for (const r of old) affectedOwners.push(r.id)
      }
    }

    for (const key of affectedKeys) {
      // allow a long-running build to be cancelled mid-parse; an abort here
      // throws and is turned into a failed (non-committing) run by runBuild.
      if (aborted()) throw new Error('build aborted')
      const collection = project.collections[key]
      const {
        records,
        diagnostics: collectionDiagnostics,
        sourcePaths
      } = await parseCollection(project, key, collection, log, session.files, assetStore, session.assetCache, session.store, e => collectedEffects.push(e))
      diagnostics.push(...collectionDiagnostics)
      parsed.records.set(key, records)
      parsed.sources.set(key, sourcePaths)
    }

    // Re-check abort before committing any candidate state — the signal may
    // have been triggered during an async parseCollection call.
    if (aborted()) throw new Error('build aborted')

    // candidate effect index: drop affected owners' old effects, apply new ones
    const candidateIndex = session.effectIndex.patch(affectedOwners, collectedEffects)

    // validate unique effects collected this run against the full candidate index
    for (const effect of collectedEffects) {
      if (effect.type !== 'unique') continue
      const conflict = candidateIndex.findUniqueConflict(effect.group, effect.value, effect.owner)
      if (conflict != null) {
        diagnostics.push(
          createDiagnostic({
            severity: 'error',
            code: 'unique.duplicate',
            message: `Duplicate value '${effect.value}' in group '${effect.group}' conflicts with '${conflict}'`,
            recordId: effect.owner,
            stage: 'schema'
          })
        )
      }
    }

    const result = aggregateResult(project, parsed, diagnostics)

    // asset reference effects -> graph edges
    const assetEffects = collectedEffects.filter((e): e is AssetReferenceEffect => e.type === 'asset').map(e => ({ owner: e.owner, assetPath: e.assetPath }))
    const dependencyEffects = collectedEffects
      .filter((e): e is SourceDependencyEffect => e.type === 'dependency')
      .map(e => ({ owner: e.owner, sourceId: e.sourceId }))
    const graphEdges = buildGraphEdges(project, parsed, assetEffects, dependencyEffects)

    const strict = options.strict ?? project.strict ?? false
    const fatal = hasFatalDiagnostic(diagnostics) || (strict && diagnostics.some(d => d.severity === 'error'))
    if (fatal) {
      return { status: 'failure', diagnostics, effects: candidateIndex, graphEdges, records: new Map(), assets: [] }
    }

    if (aborted()) throw new Error('build aborted')

    // prepare hook
    const projectInfo = { root: project.root, configPath: project.configPath, collections: project.collections }
    const prepared = await applyPrepare(result, project.prepare, projectInfo, diagnostics)
    const finalResult = prepared.result

    if (aborted()) throw new Error('build aborted')

    // output plan + write
    const writes = planWrites(project, parsed, finalResult, split)
    if (prepared.action === 'continue') {
      await writer.writeData(session.output, project.output.data, { writes })
    }
    const assetRecords = assetStore.list()
    await writer.writeAssets(
      session.output,
      project.output.assets,
      assetRecords.map(a => ({ path: a.outputName, sourcePath: a.sourcePath }))
    )

    const recordsMap = new Map<string, readonly string[]>()
    for (const [key, recs] of parsed.records)
      recordsMap.set(
        key,
        recs.map(r => r.id)
      )

    return {
      status: 'success',
      result: finalResult,
      diagnostics,
      effects: candidateIndex,
      graphEdges,
      records: recordsMap,
      assets: assetRecords.map(a => a.sourcePath)
    }
  }

  const runOnce = async (project: Project, options: BuildOptions, change: RebuildChange | undefined, split: boolean, log: Logger): Promise<BuildResult> => {
    if (currentSession == null) throw new Error('session missing')
    const runResult = await runBuild(currentSession, { execute: () => execute(currentSession!, project, options, change, split, log) })
    if (runResult.status === 'failure' || runResult.result == null) {
      throw new VeliteError('Build failed', [...runResult.diagnostics])
    }
    return runResult.result
  }

  return {
    get config() {
      return currentProject
    },

    get diagnostics() {
      return currentSession?.diagnostics ?? []
    },

    async build(options = {}) {
      const log = resolveLogger(options)
      if (options.logLevel != null && typeof (logger as { set?: (l: LogLevel) => void }).set === 'function') {
        ;(logger as { set: (l: LogLevel) => void }).set(options.logLevel)
      }

      const loadOpts: LoadOptions = { clean: options.clean, strict: options.strict, cwd: options.cwd }
      const project = await configLoader.load(options.config, loadOpts)
      const configChanged =
        currentProject != null &&
        (currentProject.configPath !== project.configPath ||
          currentProject.output.data !== project.output.data ||
          currentProject.output.assets !== project.output.assets ||
          currentProject.output.base !== project.output.base ||
          currentProject.output.format !== project.output.format)

      // `build()` is always a full build: a fresh session with reset incremental
      // state. This is what makes config reloads safe — the previous session's
      // file cache, asset cache, store, effect index and graph are all dropped so
      // no stale state leaks into the new project. (Incremental rebuilds reuse
      // session caches via `rebuild()`, not `build()`.)
      currentSession = createSession({ project, logger: log, output: outputState })
      parsed = createParsedCache()
      currentProject = project
      currentOptions = options

      if (configChanged) {
        // a different config can change output paths; drop the emit cache so
        // stale outputs from the previous project are not treated as current.
        outputState.emitted.clear()
      }

      if (project.output.clean) {
        await rm(project.output.data, { recursive: true, force: true })
        await rm(project.output.assets, { recursive: true, force: true })
        outputState.emitted.clear()
      }
      await mkdir(project.output.data, { recursive: true })
      await mkdir(project.output.assets, { recursive: true })

      log.info?.('building...')
      const result = await runOnce(project, options, undefined, false, log)
      log.info?.('build finished')
      return result
    },

    async rebuild(change) {
      if (currentProject == null || currentSession == null) throw new Error('rebuild() called before build()')
      const log = resolveLogger(currentOptions)
      const project = currentProject

      if (change == null) {
        // full rebuild through the long-lived engine: reset incremental state
        parsed = createParsedCache()
        currentSession.files.clear()
        currentSession.assetCache.clear()
      } else {
        for (const path of change.paths) currentSession.files.delete(normalize(path))
      }

      await mkdir(project.output.data, { recursive: true })
      await mkdir(project.output.assets, { recursive: true })

      log.info?.('rebuilding...')
      const result = await runOnce(project, currentOptions, change, true, log)
      log.info?.('rebuild finished')
      return result
    },

    hasAssetSource(path: string) {
      return currentSession?.assetCache.hasSource(path) ?? false
    },

    invalidateAssetSource(path: string) {
      if (currentSession == null) return []
      const owners = currentSession.assetCache.invalidateSource(path)
      for (const owner of owners) currentSession.files.delete(normalize(owner))
      return owners
    }
  }
}

export { createConfigLoader }
