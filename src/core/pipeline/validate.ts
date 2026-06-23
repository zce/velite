import { diagnostic } from '../diagnostic'
import { createContentFile, createSessionStore, resolveBody, runWithContext } from '../schema/context'
import { join } from '../util/path'

import type { FileSystem, ImageProcessor } from '../../runtime'
import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { Entry } from '../model'
import type { AssetRequest, ImageMetadata, ProjectCollectionInfo, ProjectInfo } from '../schema/context'
import type { Effect } from '../schema/effects'
import type { AssetKey, AssetResult, BlurOptions } from './asset'
import type { Loaded, Validated, ValidateKey } from './types'

/** Build the read-only project snapshot exposed to schemas from the resolved config. */
export const buildProjectInfo = (config: ResolvedConfig): ProjectInfo => {
  const collections: Record<string, ProjectCollectionInfo> = {}
  for (const c of config.collections) {
    collections[c.name] = { pattern: c.include, single: c.single, schema: c.schema }
  }
  return { root: config.root, configPath: config.configPath, collections, output: config.output, markdown: config.markdown, mdx: config.mdx }
}

/**
 * The runtime capabilities the validate derivation needs. Keep dependencies at
 * adapter-object granularity (`fs`, `image`) instead of wiring individual
 * methods; function-level DI makes the pipeline harder to read without adding a
 * useful test seam here.
 */
interface ValidateRuntime {
  fs: FileSystem
  image?: ImageProcessor
}

const DEFAULT_BLUR_WIDTH = 8

/**
 * Build the {@link SchemaContext.probeImage} closure from a runtime
 * `ImageProcessor`. Returns zero metadata when no processor is present, mirroring
 * the no-sharp degradation path used by the asset derivation.
 */
const createProbeImage =
  (image: ImageProcessor | undefined) =>
  async (bytes: Uint8Array, blur?: BlurOptions): Promise<ImageMetadata> => {
    if (image === undefined) return { width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    const probed = await image.probe(bytes)
    const { width, height } = probed
    if (width <= 0 || height <= 0) return { width, height, format: probed.format, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    const requestedWidth = blur?.width ?? DEFAULT_BLUR_WIDTH
    const blurHeight = blur?.height ?? Math.max(1, Math.round((requestedWidth * height) / width))
    const blurDataURL = await image.blurDataURL(bytes, { width, height }, { width: requestedWidth, height: blurHeight, quality: blur?.quality })
    return { width, height, format: probed.format, blurDataURL, blurWidth: requestedWidth, blurHeight }
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
 * The `asset(assetKey, request?)` closure demands the asset derivation through
 * the engine context (request includes optional `template` and `blur`),
 * recording the dependency so a later `engine.set('asset:'+key, ...)`
 * invalidates this source's memo (and everything downstream). The `readFile` /
 * `probeImage` closures live outside the engine — they implement absolute-path
 * support for `s.image({ absoluteRoot })` and don't need memoization (the
 * source file's bytes already invalidate the validate derivation).
 */
export const createValidateDerivation = (
  config: ResolvedConfig,
  load: Derivation<string, Loaded>,
  asset: Derivation<AssetKey, AssetResult>,
  runtime: ValidateRuntime
): Derivation<ValidateKey, Validated> => {
  // One store per validate derivation = per build session (recreated on
  // config-reload, when loadSession rebuilds the pipeline). Shared across
  // rebuilds so custom schemas can lazily initialise session-scoped state.
  const store = createSessionStore()
  return {
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
      const demandAsset = (assetKey: string, request?: AssetRequest): Promise<AssetResult> =>
        context.get(asset, { assetKey, template: request?.template ?? config.output.name, blur: request?.blur })
      const probeImage = createProbeImage(runtime.image)
      const readFile = (p: string): Promise<Uint8Array> => runtime.fs.read(p)

      for (let index = 0; index < loaded.entries.length; index++) {
        const raw = loaded.entries[index]!
        const body = resolveBody(raw.data, raw.meta)
        const file = createContentFile(raw.source, absPath, body)
        const key = raw.key === '' ? undefined : typeof raw.key === 'number' ? String(raw.key) : raw.key
        const record = { id: raw.id, ...(key != null ? { key } : {}), index }

        const parsed = await runWithContext(
          { project, file, record, store, collectEffect: e => effects.push(e), asset: demandAsset, readFile, probeImage },
          () => col.schema.safeParseAsync(raw.data)
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
  }
}
