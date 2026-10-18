import { collectionOrder } from '../config'
import { compareDiagnostic, diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { CollectionResult } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Emitted } from './types'

const ownerKey = (collection: string, owner: string): string => JSON.stringify([collection, owner])

const uniqueCandidates = (config: ResolvedConfig, effects: readonly Effect[]): { diagnostics: Diagnostic[]; invalid: Set<string> } => {
  const buckets = new Map<string, { value: string; group: string; owners: Map<string, Effect> }>()
  for (const effect of effects) {
    if (effect.type !== 'unique') continue
    const key = JSON.stringify([effect.group, effect.value])
    let bucket = buckets.get(key)
    if (bucket === undefined) {
      bucket = { group: effect.group, value: effect.value, owners: new Map() }
      buckets.set(key, bucket)
    }
    bucket.owners.set(ownerKey(effect.system.collectionId, effect.system.owner), effect)
  }

  const diagnostics: Diagnostic[] = []
  const invalid = new Set<string>()
  for (const bucket of buckets.values()) {
    if (bucket.owners.size <= 1) continue
    for (const [key, effect] of bucket.owners) {
      invalid.add(key)
      const collection = effect.system.collectionId
      diagnostics.push(
        diagnostic('error', 'SCHEMA_INVALID', `duplicate unique value "${bucket.value}" in group "${bucket.group}"`, {
          stage: 'schema',
          provenance: {
            scope: 'record',
            collection: { order: collectionOrder(config, collection), id: collection },
            source: { path: effect.system.sourcePath },
            record: { index: effect.system.recordIndex, id: effect.system.owner }
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
 * bytes in pass 2. Runs the cross-record uniqueness scan (`uniqueCandidates`),
 * filters conflicting candidates, then applies singleton cardinality and
 * selection on every emit (full and incremental).
 */
export const createEmitDerivation = (config: ResolvedConfig, collect: Derivation<string, Collected>): Derivation<null, Emitted> => ({
  name: 'emit',
  async compute(context) {
    const collections: Record<string, CollectionResult> = {}
    const diagnostics: Diagnostic[] = []
    const effects: Effect[] = []
    for (const col of config.collections) {
      const collected = await context.get(collect, col.name)
      collections[col.name] = collected.result
      diagnostics.push(...collected.diagnostics)
      effects.push(...collected.effects)
    }
    const checked = uniqueCandidates(config, effects)
    diagnostics.push(...checked.diagnostics)
    for (const [name, collection] of Object.entries(collections)) {
      const entries = collection.entries.filter(entry => !checked.invalid.has(ownerKey(name, entry.id)))
      const single = collection.mode === 'single'
      if (single) {
        const order = collectionOrder(config, name)
        if (entries.length === 0) {
          diagnostics.push(
            diagnostic('error', 'COLLECTION_EMPTY', `single collection "${name}" matched no valid entry`, {
              stage: 'schema',
              provenance: { scope: 'collection', collection: { order, id: name } }
            })
          )
        } else if (entries.length > 1) {
          diagnostics.push(
            diagnostic('warn', 'COLLECTION_MULTIPLE', `single collection "${name}" matched ${entries.length} entries; using the first`, {
              stage: 'schema',
              provenance: { scope: 'collection', collection: { order, id: name } }
            })
          )
        }
      }
      collections[name] = { ...collection, entries: single ? entries.slice(0, 1) : entries }
    }
    return {
      output: { collections },
      effects: effects.filter(effect => !checked.invalid.has(ownerKey(effect.system.collectionId, effect.system.owner))),
      diagnostics
    }
  }
})
