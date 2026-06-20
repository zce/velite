import type { BuildResult, Collections } from '../collections'
import type { Diagnostic } from './diagnostics'

/**
 * A successful build snapshot.
 *
 * Snapshots are the committed, trusted result of a build run. A failed run
 * never replaces the previous snapshot — it is rolled back entirely.
 */
export interface Snapshot<T extends Collections = Collections> {
  readonly result: BuildResult<T>
  readonly diagnostics: readonly Diagnostic[]
  /** Record ids that were live in this build, per collection key. */
  readonly records: ReadonlyMap<string, readonly string[]>
  /** Asset source paths emitted in this build. */
  readonly assets: readonly string[]
}
