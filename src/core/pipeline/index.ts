import { createMatcher } from '../util/glob'
import { createAssetDerivation } from './asset'
import { createCollectDerivation } from './collect'
import { createSourcesDerivation } from './discover'
import { createEmitDerivation } from './emit'
import { createLoadDerivation } from './load'
import { createUniqueCheckDerivation } from './unique'
import { createValidateDerivation } from './validate'

import type { ImageProcessor } from '../../runtime'
import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { LoaderRegistry } from '../loader'
import type { Source } from '../model'
import type { Matcher } from '../util/glob'
import type { AssetResult } from './asset'
import type { Collected, Emitted, Loaded, UniqueChecked, Validated, ValidateKey } from './types'

export interface Pipeline {
  sources: Derivation<string, Source[]>
  load: Derivation<string, Loaded>
  validate: Derivation<ValidateKey, Validated>
  collect: Derivation<string, Collected>
  /** Cross-file uniqueness conflict scan (keyed by `null` — scans all collections). */
  uniqueCheck: Derivation<null, UniqueChecked>
  emit: Derivation<null, Emitted>
  /** Per-asset derivation: assetKey → public url + image metadata. */
  asset: Derivation<string, AssetResult>
}

/**
 * Build the set of domain derivations, closing over the resolved config and
 * loader registry. Config/schemas are captured here (not engine inputs): a
 * config change creates a fresh builder/engine epoch, so they never need hashing.
 *
 * Takes only the runtime capabilities the pipeline actually uses (just
 * `image`, for asset metadata) rather than the whole `Runtime` object: every
 * other capability (`fs`, `modules`, `watch`, `logger`) belongs to the driver
 * that *runs* the pipeline, not to the pipeline definition itself.
 */
export const createPipeline = (config: ResolvedConfig, loaders: LoaderRegistry, image: ImageProcessor | undefined): Pipeline => {
  const matchers = new Map<string, Matcher>(config.collections.map(c => [c.name, createMatcher(c.include, c.exclude)]))
  const sources = createSourcesDerivation(config, matchers)
  const load = createLoadDerivation(loaders)
  const asset = createAssetDerivation(config, image)
  const validate = createValidateDerivation(config, load, asset)
  const collect = createCollectDerivation(config, sources, validate)
  const uniqueCheck = createUniqueCheckDerivation(config, sources, validate)
  const emit = createEmitDerivation(config, collect, uniqueCheck)
  return { sources, load, validate, collect, uniqueCheck, emit, asset }
}

export { TREE, fileInput } from './inputs'
export { assetInput, assetKeyOf, publicUrlOf, renderAssetName } from './asset'
export type { TreeFile } from './inputs'
export type { AssetResult } from './asset'
export type { UniqueChecked } from './unique'
