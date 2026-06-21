// Cross-file uniqueness check — a two-stage aggregation derivation.
//
// Schemas that need cross-file uniqueness (`s.unique()`, `s.slug()`) never judge
// conflicts during validation: they only *collect* `UniqueEffect`s. This
// derivation reads all validate results, groups effects by `(group, value)` and
// emits a `SCHEMA_INVALID` diagnostic for every owner that shares a group+value
// with at least one other distinct owner.
//
// The dependency graph is acyclic: uniqueCheck → validate → load → read. Validate
// does NOT read uniqueCheck, so there is no cycle. Keyed by `null` (one
// computation scans every collection/source) because uniqueness groups are
// declared at runtime by schemas, not known upfront from config.

import { diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { Source } from '../model'
import type { Validated, ValidateKey } from './types'

export interface UniqueChecked {
  diagnostics: Diagnostic[]
}

/** One `(group, value)` bucket tracking every owner that registered it. */
interface UniqueBucket {
  group: string
  value: string
  /** owner record id → collection name (for diagnostic context). */
  owners: Map<string, string | undefined>
}

const SEPARATOR = '\0'

/**
 * `uniqueCheck()` → diagnostics for cross-file unique conflicts.
 *
 * Demands `sources(collection)` + `validate({collection, path})` for every
 * source of every collection, gathering `UniqueEffect`s. A conflict exists when
 * more than one distinct owner registered the same `(group, value)` pair; each
 * conflicting owner gets a `SCHEMA_INVALID` diagnostic. Non-fatal (schema stage)
 * per the spec — uniqueness conflicts do not abort the build by themselves.
 */
export const createUniqueCheckDerivation = (
  config: ResolvedConfig,
  sources: Derivation<string, Source[]>,
  validate: Derivation<ValidateKey, Validated>
): Derivation<null, UniqueChecked> => ({
  name: 'uniqueCheck',
  async compute(context) {
    const buckets = new Map<string, UniqueBucket>()
    for (const col of config.collections) {
      const found = await context.get(sources, col.name)
      for (const source of found) {
        const validated = await context.get(validate, { collection: col.name, path: source.path })
        for (const effect of validated.effects) {
          if (effect.type !== 'unique') continue
          const key = `${effect.group}${SEPARATOR}${effect.value}`
          let bucket = buckets.get(key)
          if (bucket === undefined) {
            bucket = { group: effect.group, value: effect.value, owners: new Map() }
            buckets.set(key, bucket)
          }
          bucket.owners.set(effect.owner, col.name)
        }
      }
    }

    const diagnostics: Diagnostic[] = []
    for (const bucket of buckets.values()) {
      if (bucket.owners.size <= 1) continue
      for (const [owner, collection] of bucket.owners) {
        diagnostics.push(
          diagnostic('error', 'SCHEMA_INVALID', `duplicate unique value "${bucket.value}" in group "${bucket.group}"`, {
            stage: 'schema',
            collection,
            recordId: owner
          })
        )
      }
    }
    return { diagnostics }
  }
})
