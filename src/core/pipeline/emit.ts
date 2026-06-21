import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { CollectionResult } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Emitted } from './types'

/**
 * `emit()` → the complete LogicalOutput across all collections (the build's root
 * derivation). Demanding this drives the whole pipeline. Aggregates effects from
 * every collection; the driver consumes asset-reference effects to feed asset
 * bytes in pass 2.
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
    return { output: { collections }, effects, diagnostics }
  }
})
