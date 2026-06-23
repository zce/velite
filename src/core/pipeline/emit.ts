import { diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { CollectionResult } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Emitted, UniqueChecked } from './types'

const UNIQUE_SEPARATOR = '\0'

const uniqueDiagnostics = (effects: readonly Effect[], collectionByOwner: ReadonlyMap<string, string>): Diagnostic[] => {
  const buckets = new Map<string, { value: string; group: string; owners: Set<string> }>()
  for (const effect of effects) {
    if (effect.type !== 'unique') continue
    const key = `${effect.group}${UNIQUE_SEPARATOR}${effect.value}`
    let bucket = buckets.get(key)
    if (bucket === undefined) {
      bucket = { group: effect.group, value: effect.value, owners: new Set() }
      buckets.set(key, bucket)
    }
    bucket.owners.add(effect.owner)
  }

  const diagnostics: Diagnostic[] = []
  for (const bucket of buckets.values()) {
    if (bucket.owners.size <= 1) continue
    for (const owner of bucket.owners) {
      diagnostics.push(
        diagnostic('error', 'SCHEMA_INVALID', `duplicate unique value "${bucket.value}" in group "${bucket.group}"`, {
          stage: 'schema',
          collection: collectionByOwner.get(owner),
          recordId: owner
        })
      )
    }
  }
  return diagnostics
}

/**
 * `emit()` → the complete LogicalOutput across all collections (the build's root
 * derivation). Demanding this drives the whole pipeline. Aggregates effects from
 * every collection; the driver consumes asset-reference effects to feed asset
 * bytes in pass 2. Also demands `uniqueCheck` so cross-file uniqueness conflicts
 * surface as diagnostics on every emit (full and incremental).
 */
export const createEmitDerivation = (
  config: ResolvedConfig,
  collect: Derivation<string, Collected>,
  _uniqueCheck: Derivation<null, UniqueChecked>
): Derivation<null, Emitted> => ({
  name: 'emit',
  async compute(context) {
    const collections: Record<string, CollectionResult> = {}
    const diagnostics: Diagnostic[] = []
    const effects: Effect[] = []
    const collectionByOwner = new Map<string, string>()
    for (const col of config.collections) {
      const collected = await context.get(collect, col.name)
      collections[col.name] = collected.result
      for (const entry of collected.result.entries) collectionByOwner.set(entry.id, col.name)
      diagnostics.push(...collected.diagnostics)
      effects.push(...collected.effects)
    }
    diagnostics.push(...uniqueDiagnostics(effects, collectionByOwner))
    return { output: { collections }, effects, diagnostics }
  }
})
