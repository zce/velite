import { compareDiagnostic, diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { CollectionResult } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Emitted, UniqueChecked } from './types'

const ownerKey = (collection: string, owner: string): string => JSON.stringify([collection, owner])

const uniqueCandidates = (config: ResolvedConfig, effects: readonly Effect[], collectionByOwner: ReadonlyMap<string, string>) => {
  const buckets = new Map<string, { value: string; group: string; owners: Map<string, Effect> }>()
  for (const effect of effects) {
    if (effect.type !== 'unique') continue
    const key = JSON.stringify([effect.group, effect.value])
    let bucket = buckets.get(key)
    if (bucket === undefined) {
      bucket = { group: effect.group, value: effect.value, owners: new Map() }
      buckets.set(key, bucket)
    }
    const collection = effect.system?.collectionId ?? collectionByOwner.get(effect.owner) ?? ''
    bucket.owners.set(ownerKey(collection, effect.owner), effect)
  }

  const diagnostics: Diagnostic[] = []
  const invalid = new Set<string>()
  for (const bucket of buckets.values()) {
    if (bucket.owners.size <= 1) continue
    for (const [key, effect] of bucket.owners) {
      invalid.add(key)
      const owner = effect.owner
      const collection = effect.system?.collectionId ?? collectionByOwner.get(owner) ?? ''
      const collectionOrder = config.collections.findIndex(c => c.name === collection)
      const sourcePath = effect.system?.sourcePath ?? owner.split('#')[0] ?? ''
      diagnostics.push(
        diagnostic('error', 'SCHEMA_INVALID', `duplicate unique value "${bucket.value}" in group "${bucket.group}"`, {
          stage: 'schema',
          provenance: {
            scope: 'record',
            collection: { order: collectionOrder, id: collection },
            source: { path: sourcePath },
            record: { index: effect.system?.recordIndex ?? 0, id: owner }
          }
        })
      )
    }
  }
  return { diagnostics: diagnostics.sort(compareDiagnostic), invalid }
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
    const checked = uniqueCandidates(config, effects, collectionByOwner)
    diagnostics.push(...checked.diagnostics)
    for (const [name, collection] of Object.entries(collections))
      collections[name] = { ...collection, entries: collection.entries.filter(entry => !checked.invalid.has(ownerKey(name, entry.id))) }
    return {
      output: { collections },
      effects: effects.filter(effect => !checked.invalid.has(ownerKey(effect.system?.collectionId ?? collectionByOwner.get(effect.owner) ?? '', effect.owner))),
      diagnostics
    }
  }
})
