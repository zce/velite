import type { Collection, CollectionResult } from '../model'

/**
 * The complete, deterministic build result. Replace semantics: a given input
 * state corresponds to exactly one logical output, regardless of full vs
 * incremental build. Physical layout/writing is a separate concern.
 */
export interface LogicalOutput {
  collections: Record<Collection, CollectionResult>
}
