import { diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Diagnostic } from '../diagnostic'
import type { Derivation } from '../engine'
import type { Entry, Source } from '../model'
import type { Effect } from '../schema/effects'
import type { Collected, Validated, ValidateKey } from './types'

/**
 * `collect(name)` → the full, ordered CollectionResult. Reads the source list,
 * then each source's validated entries, then flattens, sorts and (for single
 * collections) collapses to one entry with diagnostics. Aggregates per-source
 * effects (asset refs, unique, ...) into the returned effect list.
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
    entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    const single = config.collections.find(c => c.name === name)?.single ?? false
    if (!single) {
      return { result: { collection: name, mode: 'list', entries }, effects, diagnostics }
    }
    if (entries.length === 0) {
      diagnostics.push(diagnostic('error', 'COLLECTION_EMPTY', `single collection "${name}" matched no valid entry`, { stage: 'schema', collection: name }))
    } else if (entries.length > 1) {
      diagnostics.push(
        diagnostic('warn', 'COLLECTION_MULTIPLE', `single collection "${name}" matched ${entries.length} entries; using the first`, {
          stage: 'schema',
          collection: name
        })
      )
    }
    return { result: { collection: name, mode: 'single', entries: entries.slice(0, 1) }, effects, diagnostics }
  }
})
