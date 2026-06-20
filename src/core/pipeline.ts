import { createDiagnostic, hasFatalDiagnostic } from './diagnostics'

import type { BuildResult, Collections } from '../collections'
import type { PrepareHook } from '../config'
import type { EffectIndex } from '../schemas/effects'
import type { Diagnostic } from './diagnostics'
import type { GraphEdge } from './graph'
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
    // An unexpected throw inside execute is treated as a failed run: no
    // candidate state is committed, and the error is surfaced as a diagnostic
    // so callers always receive a VeliteError with structured diagnostics.
    runResult = {
      status: 'failure',
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'pipeline.uncaught',
          message: err instanceof Error ? err.message : String(err),
          stage: 'output',
          cause: err
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
  project?: { root: string; configPath: string; collections: TCollections },
  diagnostics: readonly Diagnostic[] = []
): Promise<PrepareResolution<TCollections>> => {
  if (hook == null) return { action: 'continue', result }
  const projectInfo = project ?? { root: '', configPath: '', collections: {} as TCollections }
  const returned = await hook(result, { project: projectInfo, diagnostics })
  if (returned === false) return { action: 'skip-output', result }
  if (returned == null) return { action: 'continue', result }
  return { action: 'continue', result: returned }
}

export { hasFatalDiagnostic }
