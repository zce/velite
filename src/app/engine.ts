import { mkdir, rm } from 'node:fs/promises'
import { normalize } from 'node:path'

import { createAssetStore } from '../assets/store'
import { collectionAffected } from '../collections/discover'
import { defaultConfigLoader } from '../config'
import { codeFromDiagnostics, createDiagnostic, hasFatalDiagnostic, VeliteError } from '../core/errors'
import { buildGraphEdges } from '../core/graph'
import { aggregateResult, applyPrepare, createParsedCache, parseCollection, runBuild, throwIfAborted } from '../core/pipeline'
import { resolveProject } from '../core/project'
import { createSession } from '../core/session'
import { planWrites } from '../output/plan'
import { createWriter } from '../output/write'
import { createLogger } from '../runtime/logger'

import type { BuildResult } from '../collections'
import type { ConfigLoader } from '../config'
import type { Diagnostic } from '../core/errors'
import type { BuildRunResult } from '../core/pipeline'
import type { Project } from '../core/project'
import type { Session } from '../core/session'
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

export interface EngineOptions {
  writer?: Writer
  logger?: Logger
  /** Override config loading (for testing). Defaults to the real jiti-based loader. */
  configLoader?: ConfigLoader
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

export const createEngine = (options: EngineOptions = {}): Engine => {
  const configLoader = options.configLoader ?? defaultConfigLoader
  // Engine and writer share the same logger so logLevel changes are visible to both.
  const injectedLogger = options.logger as (Logger & { set?(level: LogLevel): void }) | undefined
  const logger: Logger & { set?(level: LogLevel): void } = injectedLogger ?? createLogger('info')
  const writer: Writer = options.writer ?? createWriter({ logger })

  let currentProject: Project | undefined
  let currentOptions: BuildOptions = {}
  let currentSession: Session | undefined
  let parsed = createParsedCache()
  const outputState = { emitted: new Map<string, string>() }

  const resolveLogger = (opts: BuildOptions): Logger => {
    if (opts.logger != null) return opts.logger
    return logger
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

    // An aborted run never commits: short-circuit immediately. Subsequent
    // checkpoints call `throwIfAborted` to cancel a long-running run mid-flight;
    // `runBuild` turns the sentinel into a clean `aborted` diagnostic.
    throwIfAborted(options.signal)

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
      throwIfAborted(options.signal)
      const collection = project.collections[key]
      const { records, diagnostics: collectionDiagnostics } = await parseCollection(
        project,
        key,
        collection,
        log,
        session.files,
        assetStore,
        session.assetCache,
        session.store,
        e => collectedEffects.push(e)
      )
      diagnostics.push(...collectionDiagnostics)
      parsed.records.set(key, records)
    }

    // Re-check abort before committing any candidate state — the signal may
    // have been triggered during an async parseCollection call.
    throwIfAborted(options.signal)

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

    const result = aggregateResult(project, parsed.records, diagnostics)

    // asset reference effects -> graph edges
    const assetEffects = collectedEffects.filter((e): e is AssetReferenceEffect => e.type === 'asset').map(e => ({ owner: e.owner, assetPath: e.assetPath }))
    const dependencyEffects = collectedEffects
      .filter((e): e is SourceDependencyEffect => e.type === 'dependency')
      .map(e => ({ owner: e.owner, sourceId: e.sourceId }))
    const graphEdges = buildGraphEdges(project.collections, parsed.records, assetEffects, dependencyEffects)

    const strict = options.strict ?? project.strict ?? false
    const fatal = hasFatalDiagnostic(diagnostics) || (strict && diagnostics.some(d => d.severity === 'error'))
    if (fatal) {
      return { status: 'failure', diagnostics, effects: candidateIndex, graphEdges, records: new Map(), assets: [] }
    }

    throwIfAborted(options.signal)

    // prepare hook
    const projectInfo = { root: project.root, configPath: project.config.path, collections: project.collections }
    const prepared = await applyPrepare(result, project.prepare, projectInfo, diagnostics)
    const finalResult = prepared.result

    throwIfAborted(options.signal)

    // output plan + write
    const writes = planWrites(
      { collections: project.collections, format: project.output.format, dataDir: project.output.data, configPath: project.config.path },
      parsed.records,
      finalResult,
      split
    )
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
      throw new VeliteError(codeFromDiagnostics(runResult.diagnostics), { message: 'Build failed', diagnostics: [...runResult.diagnostics] })
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
      if (options.logLevel != null && logger.set != null) {
        logger.set(options.logLevel)
      }

      const configPath = await configLoader.resolvePath(options.config, options.cwd)
      const loaded = await configLoader.load(configPath)
      const project = resolveProject(loaded, { clean: options.clean, strict: options.strict })
      const configChanged =
        currentProject != null &&
        (currentProject.config.path !== project.config.path ||
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
