import { diagnostic } from '../diagnostic'
import { createContentFile, resolveBody, runWithContext } from '../schema/context'
import { join } from '../util/path'

import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { Entry } from '../model'
import type { ProjectCollectionInfo, ProjectInfo } from '../schema/context'
import type { Effect } from '../schema/effects'
import type { AssetResult } from './asset'
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
 * via `collectEffect` and returned alongside the entries; the driver consumes
 * asset-reference effects to drive the two-pass asset flow.
 *
 * The `asset(assetKey)` closure demands the asset derivation through the engine
 * context, recording the dependency so a later `engine.set('asset:'+key, ...)`
 * invalidates this source's memo (and everything downstream).
 */
export const createValidateDerivation = (
  config: ResolvedConfig,
  load: Derivation<string, Loaded>,
  asset: Derivation<string, AssetResult>
): Derivation<ValidateKey, Validated> => ({
  name: 'validate',
  async compute(context, { collection, path }) {
    const loaded = await context.get(load, path)
    const col = config.collections.find(c => c.name === collection)
    const entries: Entry[] = []
    const effects: Effect[] = []
    const diagnostics = [...loaded.diagnostics]
    if (col === undefined) return { entries, effects, diagnostics }

    const project = buildProjectInfo(config)
    const absPath = join(config.root, path)
    const demandAsset = (assetKey: string): Promise<AssetResult> => context.get(asset, assetKey)

    for (let index = 0; index < loaded.entries.length; index++) {
      const raw = loaded.entries[index]!
      const body = resolveBody(raw.data, raw.meta)
      const file = createContentFile(raw.source, absPath, body)
      const key = raw.key === '' ? undefined : typeof raw.key === 'number' ? String(raw.key) : raw.key
      const record = { id: raw.id, ...(key != null ? { key } : {}), index }

      const parsed = await runWithContext({ project, file, record, collectEffect: e => effects.push(e), asset: demandAsset }, () =>
        col.schema.safeParseAsync(raw.data)
      )

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
    return { entries, effects, diagnostics }
  }
})
