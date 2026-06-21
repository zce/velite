import { diagnostic } from '../diagnostic'
import { createContentFile, resolveBody, runWithContext } from '../schema/context'
import { posix } from '../util/path'

import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { Entry } from '../model'
import type { ProjectCollectionInfo, ProjectInfo } from '../schema/context'
import type { Effect } from '../schema/effects'
import type { Loaded, Validated, ValidateKey } from './types'

/** Build the read-only project snapshot exposed to schemas from the resolved config. */
const buildProjectInfo = (config: ResolvedConfig): ProjectInfo => {
  const collections: Record<string, ProjectCollectionInfo> = {}
  for (const c of config.collections) {
    collections[c.name] = { pattern: c.include, single: c.single, schema: c.schema }
  }
  return { root: config.root, configPath: config.configPath, collections, output: config.output }
}

/**
 * `validate({collection, path})` → validated entries for one source.
 * Source-grained, matching the PRD's source-level invalidation contract.
 *
 * Each record is parsed inside a schema context (`runWithContext`) so built-in
 * content schemas (`s.markdown()`, `s.raw()`, ...) can read the current file's
 * body and project via `context()`. Schema effects are accumulated per record
 * via `collectEffect`; they are consumed by the effect-index derivation in M6.
 */
export const createValidateDerivation = (config: ResolvedConfig, load: Derivation<string, Loaded>): Derivation<ValidateKey, Validated> => ({
  name: 'validate',
  async compute(context, { collection, path }) {
    const loaded = await context.get(load, path)
    const col = config.collections.find(c => c.name === collection)
    const entries: Entry[] = []
    const diagnostics = [...loaded.diagnostics]
    if (col === undefined) return { entries, diagnostics }

    const project = buildProjectInfo(config)
    const absPath = posix.join(config.root, path)

    for (let index = 0; index < loaded.entries.length; index++) {
      const raw = loaded.entries[index]!
      const body = resolveBody(raw.data, raw.meta)
      const file = createContentFile(raw.source, absPath, body)
      const key = raw.key === '' ? undefined : typeof raw.key === 'number' ? String(raw.key) : raw.key
      const record = { id: raw.id, ...(key != null ? { key } : {}), index }
      // Per-record effect accumulator. Collected by schemas via collectEffect;
      // wired into the effect-index derivation in M6.
      const effects: Effect[] = []

      const parsed = await runWithContext({ project, file, record, collectEffect: e => effects.push(e) }, () => col.schema.safeParseAsync(raw.data))

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
