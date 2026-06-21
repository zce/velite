import { discover } from '../collections/discover'
import { createContentFile } from '../collections/file'
import { runWithContext } from '../schemas/context'
import { createDiagnostic } from './errors'
import { createRecordId, createSourceId } from './ids'

import type { AssetStore } from '../assets/store'
import type { BuildResult, Collection, Collections } from '../collections'
import type { FileCache } from '../collections/cache'
import type { PrepareContext, PrepareHook } from '../config'
import type { Logger } from '../runtime/logger'
import type { Effect, EffectIndex } from '../schemas/effects'
import type { Diagnostic } from './errors'
import type { GraphEdge } from './graph'
import type { Project } from './project'
import type { Session } from './session'
import type { Snapshot } from './snapshot'

/** Outcome of a build run's execute phase. */
export interface BuildRunResult<T extends Collections = Collections> {
  readonly status: 'success' | 'failure'
  readonly result?: BuildResult<T>
  readonly diagnostics: readonly Diagnostic[]
  /** Candidate effect index to commit on success. */
  readonly effects?: EffectIndex
  /** Candidate graph edges to commit on success (replaces the committed graph). */
  readonly graphEdges?: readonly GraphEdge[]
  /** Live record ids per collection key, for the committed snapshot. */
  readonly records?: ReadonlyMap<string, readonly string[]>
  /** Asset source paths emitted this run, for the committed snapshot. */
  readonly assets?: readonly string[]
}

/**
 * Internal sentinel thrown by `execute` to short-circuit an aborted build run.
 *
 * `runBuild` recognizes it and surfaces a clean `aborted` diagnostic instead of
 * a generic `pipeline.uncaught`. Never escapes to callers — `runOnce` turns the
 * resulting failure into a `VeliteError`.
 */
class BuildAborted extends Error {
  constructor() {
    super('build aborted')
    this.name = 'BuildAborted'
  }
}

/** Throw the abort sentinel if `signal` is already aborted. */
export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted === true) throw new BuildAborted()
}

/** Input to `runBuild`: an execute function producing a candidate build run. */
export interface BuildRunInput<T extends Collections = Collections> {
  execute: (session: Session) => Promise<BuildRunResult<T>>
}

/**
 * Orchestrate a single build run with commit/rollback semantics.
 *
 * On success the candidate state (snapshot, effect index, dependency graph) is
 * committed to the session. On failure the previous trusted state is preserved
 * entirely — a failed run never replaces the last successful snapshot, effect
 * index or graph.
 */
export const runBuild = async <T extends Collections = Collections>(session: Session, input: BuildRunInput<T>): Promise<BuildRunResult<T>> => {
  let runResult: BuildRunResult<T>
  try {
    runResult = await input.execute(session)
  } catch (err) {
    // An aborted run short-circuits with a clean diagnostic; any other
    // unexpected throw is treated as a failed run with no candidate state
    // committed, surfaced as a diagnostic so callers always receive a
    // VeliteError with structured diagnostics.
    const aborted = err instanceof BuildAborted
    runResult = {
      status: 'failure',
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: aborted ? 'aborted' : 'pipeline.uncaught',
          message: err instanceof Error ? err.message : String(err),
          stage: 'output',
          cause: aborted ? undefined : err
        })
      ]
    }
  }

  session.diagnostics = [...runResult.diagnostics]

  if (runResult.status === 'success' && runResult.result != null) {
    const snapshot: Snapshot<T> = {
      result: runResult.result,
      diagnostics: runResult.diagnostics,
      records: runResult.records ?? new Map<string, readonly string[]>(),
      assets: runResult.assets ?? []
    }
    session.snapshot = snapshot

    if (runResult.effects != null) session.effectIndex = runResult.effects

    if (runResult.graphEdges != null) {
      // Replace the committed graph with the candidate edges.
      session.graph.clear()
      for (const edge of runResult.graphEdges) session.graph.addEdge(edge.from, edge.to, edge.reason)
    }
  }

  return runResult
}

/** Result of resolving the `prepare` hook. */
export interface PrepareResolution<TCollections extends Collections> {
  readonly action: 'continue' | 'skip-output'
  readonly result: BuildResult<TCollections>
}

/**
 * Resolve the `prepare` hook return value.
 *
 * - `void` → continue with the current result, including in-place mutations.
 * - `false` → skip default output, keep the current result.
 * - `BuildResult` → continue with the returned replacement result.
 *
 * Partial patch returns are not supported.
 */
export const applyPrepare = async <TCollections extends Collections>(
  result: BuildResult<TCollections>,
  hook: PrepareHook<TCollections> | undefined,
  project?: PrepareContext<TCollections>['project'],
  diagnostics: readonly Diagnostic[] = []
): Promise<PrepareResolution<TCollections>> => {
  if (hook == null) return { action: 'continue', result }
  const projectInfo = project ?? { root: '', configPath: '', collections: {} as TCollections }
  const returned = await hook(result, { project: projectInfo, diagnostics })
  if (returned === false) return { action: 'skip-output', result }
  if (returned == null) return { action: 'continue', result }
  return { action: 'continue', result: returned }
}

/** A parsed record ready for aggregation and output planning. */
export interface ParsedRecord {
  readonly id: string
  readonly data: unknown
  readonly sourceId: string
}

/**
 * Engine-scoped cache of parsed records, keyed by collection.
 *
 * Reused across watch rebuilds so unaffected collections keep their parsed
 * records. `build()` resets it entirely; `rebuild()` only touches affected keys.
 */
export interface ParsedCache {
  records: Map<string, readonly ParsedRecord[]>
}

export const createParsedCache = (): ParsedCache => ({ records: new Map() })

/**
 * Parse all sources in a collection, returning validated records and diagnostics.
 *
 * For each discovered source file: loads via the session file cache, runs the
 * collection schema within a schema context (collecting effects), and reports
 * diagnostics for loader or schema failures. Records with fatal issues are
 * excluded from the result.
 */
export const parseCollection = async (
  project: Project,
  collectionKey: string,
  collection: Collection,
  log: Logger,
  files: FileCache,
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

/**
 * Aggregate parsed records into a logical BuildResult.
 *
 * For single collections, validates that exactly one record exists (or warns
 * and uses the first). For list collections, uses the full array.
 */
export const aggregateResult = (project: Project, parsedRecords: ReadonlyMap<string, readonly ParsedRecord[]>, diagnostics: Diagnostic[]): BuildResult => {
  const result: Record<string, unknown> = {}
  for (const [key, collection] of Object.entries(project.collections)) {
    const records = parsedRecords.get(key) ?? []
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
