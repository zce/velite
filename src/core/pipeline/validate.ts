import { diagnostic } from '../diagnostic'

import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { Entry } from '../model'
import type { Loaded, Validated, ValidateKey } from './types'

/**
 * `validate({collection, path})` → validated entries for one source.
 * Source-grained, matching the PRD's source-level invalidation contract.
 */
export const createValidateDerivation = (config: ResolvedConfig, load: Derivation<string, Loaded>): Derivation<ValidateKey, Validated> => ({
  name: 'validate',
  async compute(context, { collection, path }) {
    const loaded = await context.get(load, path)
    const col = config.collections.find(c => c.name === collection)
    const entries: Entry[] = []
    const diagnostics = [...loaded.diagnostics]
    if (col === undefined) return { entries, diagnostics }

    for (const raw of loaded.entries) {
      const parsed = await col.schema.safeParseAsync(raw.data)
      if (parsed.success) {
        entries.push({ id: raw.id, source: path, data: parsed.data })
      } else {
        for (const issue of parsed.error.issues) {
          diagnostics.push(
            diagnostic('error', 'SCHEMA_INVALID', issue.message, {
              stage: 'schema',
              file: path,
              collection,
              path: issue.path as (string | number)[]
            })
          )
        }
      }
    }
    return { entries, diagnostics }
  }
})
