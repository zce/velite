import { assetKeyOf } from '../assets'
import { diagnostic, fail } from '../diagnostic'
import { createContentFile, createSessionStore, resolveBody } from '../schema/context'
import { join } from '../util/path'

import type { FileSystem, ImageProcessor } from '../../runtime'
import type { AssetKey, AssetResult, BlurOptions } from '../assets'
import type { ResolvedConfig } from '../config'
import type { ContentDeclaration, ContentExecutionsFactory } from '../content/execution/record'
import type { Derivation } from '../engine'
import type { Entry } from '../model'
import type { AssetRequest, ImageMetadata, ProjectCollectionInfo, ProjectInfo, SchemaContext } from '../schema/context'
import type { Effect, EffectSystemOwner } from '../schema/effects'
import type { SchemaRunInput, SchemaRunner } from '../schema/runner'
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
  image: ImageProcessor
  schemaRunner: SchemaRunner
  contentExecutionsFactory: ContentExecutionsFactory
}

const DEFAULT_BLUR_WIDTH = 8

/**
 * Build the {@link SchemaContext.probeImage} closure from a runtime
 * `ImageProcessor`.
 */
const createProbeImage =
  (image: ImageProcessor) =>
  async (bytes: Uint8Array, blur?: BlurOptions): Promise<ImageMetadata> => {
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
 * Each record is parsed inside a schema run (`schemaRunner.run`) so built-in
 * result schemas and built-ins can read the current file's
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
        context.get(asset, { assetKey, template: request?.template ?? config.output.name, blur: request?.blur, metadata: request?.metadata })
      const probeImage = createProbeImage(runtime.image)
      const readFile = (p: string): Promise<Uint8Array> => runtime.fs.read(p)
      const collectionOrder = config.collections.findIndex(c => c.name === collection)

      for (let index = 0; index < loaded.entries.length; index++) {
        const raw = loaded.entries[index]!
        const body = resolveBody(raw.data, raw.meta)
        const file = createContentFile(raw.source, absPath, body)
        const key = raw.key === '' ? undefined : typeof raw.key === 'number' ? String(raw.key) : raw.key
        const record = { id: raw.id, ...(key != null ? { key } : {}), index }

        // Both declaration shapes enter this record's candidate transaction.
        // Only the final native Zod success promotes them to source candidates;
        // downstream cross-record/build checks still decide publication.
        const candidateEffects: Effect[] = []
        let acceptingEffects = true
        const systemOwner: EffectSystemOwner = {
          owner: raw.id,
          collectionOrder,
          collectionId: collection,
          sourcePath: path,
          recordIndex: index,
          recordId: raw.id
        }
        const normalizeEffect = (args: ContentDeclaration): Effect => {
          const [effect, ctx] = args
          const request = { kind: 'custom', declaration: ctx.declaration, projection: undefined, occurrence: ctx.occurrence }
          if (effect.type === 'unique') {
            return { type: 'unique', group: effect.group, value: effect.value, system: systemOwner, request }
          }
          return {
            type: 'asset',
            assetKey: assetKeyOf(effect.source, config.root),
            template: effect.output.template,
            metadata: effect.metadata,
            ...(effect.blur !== undefined ? { blur: effect.blur } : {}),
            system: systemOwner,
            request
          }
        }
        const collectEffects = (declarations: readonly ContentDeclaration[]): void => {
          if (!acceptingEffects) fail('internal', 'Record effect transaction is closed — collectEffect called after finalization')
          // Normalize the complete stage before mutating the record candidates.
          // A throwing declaration getter cannot leave a promoted prefix.
          const normalized = declarations.map(normalizeEffect)
          candidateEffects.push(...normalized)
        }

        // One content owner per actual record validation; all outcomes close
        // in the outer finally, including thrown or abandoned operations.
        const content = runtime.contentExecutionsFactory.open({
          project,
          file,
          record,
          collection: { order: collectionOrder, id: collection },
          collectEffects
        })
        const contentOperation = (request: Parameters<SchemaRunInput['contentOperation']>[0]): Promise<unknown> => content.demand(request)

        const runInput: SchemaRunInput = {
          project,
          file,
          record,
          store,
          collectEffect: content.collectEffect,
          asset: demandAsset,
          readFile,
          probeImage,
          contentOperation
        }

        try {
          const parsed = await runtime.schemaRunner.run(runInput, () => col.schema.safeParseAsync(raw.data))
          diagnostics.push(...content.diagnostics())
          acceptingEffects = false

          if (parsed.success) {
            entries.push({ id: raw.id, source: path, data: parsed.data })
            effects.push(...candidateEffects)
          } else {
            for (const issue of parsed.error.issues) {
              diagnostics.push(
                diagnostic('error', 'SCHEMA_INVALID', issue.message, {
                  stage: 'schema',
                  provenance: {
                    scope: 'record',
                    collection: { order: collectionOrder, id: collection },
                    source: { path },
                    record: { index, id: raw.id },
                    path: issue.path as (string | number)[]
                  }
                })
              )
            }
          }
        } finally {
          acceptingEffects = false
          candidateEffects.length = 0
          content.close()
        }
      }
      return { entries, effects, diagnostics }
    }
  }
}
