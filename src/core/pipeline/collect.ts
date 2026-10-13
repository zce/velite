import { compareStrings } from '../util/compare'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { Entry, Source } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Validated, ValidateKey } from './types'

/**
 * `collect(name)` → the full, ordered collection candidates. Reads the source
 * list, then flattens and sorts each source's validated entries. Aggregates
 * per-source effects and diagnostics; singleton selection waits until emit
 * determines cross-record validity.
 */
export const createCollectDerivation = (
  config: ResolvedConfig,
  sources: Derivation<string, Source[]>,
  validate: Derivation<ValidateKey, Validated>
): Derivation<string, Collected> => ({
  name: 'collect',
  async compute(context, name) {
    const found = await context.get(sources, name)
    const entries: Entry[] = []
    const diagnostics: Diagnostic[] = []
    const effects: Effect[] = []
    const validatedSources = await Promise.all(found.map(source => context.get(validate, { collection: name, path: source.path })))
    for (const validated of validatedSources) {
      entries.push(...validated.entries)
      diagnostics.push(...validated.diagnostics)
      effects.push(...validated.effects)
    }
    entries.sort((a, b) => compareStrings(a.id, b.id))

    const single = config.collections.find(c => c.name === name)?.single ?? false
    return { result: { collection: name, mode: single ? 'single' : 'list', entries }, effects, diagnostics }
  }
})
