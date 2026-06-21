import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { CollectionResult } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Emitted, UniqueChecked } from './types'

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
  uniqueCheck: Derivation<null, UniqueChecked>
): Derivation<null, Emitted> => ({
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
    // Cross-file uniqueness: scan all validate effects for conflicts. Demand
    // after collect so validate/load/read are warm; uniqueCheck does not read
    // collect/emit, so the graph stays acyclic.
    const unique = await context.get(uniqueCheck, null)
    diagnostics.push(...unique.diagnostics)
    return { output: { collections }, effects, diagnostics }
  }
})
