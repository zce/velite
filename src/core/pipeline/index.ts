import { createMatcher } from '../util/glob'
import { createAssetDerivation } from './asset'
import { createCollectDerivation } from './collect'
import { createSourcesDerivation } from './discover'
import { createEmitDerivation } from './emit'
import { createLoadDerivation } from './load'
import { createUniqueCheckDerivation } from './unique'
import { createValidateDerivation } from './validate'

import type { FileSystem, ImageProcessor } from '../../runtime'
import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { LoaderRegistry } from '../loader'
import type { Source } from '../model'
import type { Matcher } from '../util/glob'
import type { AssetKey, AssetResult } from './asset'
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
  asset: Derivation<AssetKey, AssetResult>
}

export interface PipelineDeps {
  config: ResolvedConfig
  loaders: LoaderRegistry
  fs: FileSystem
  image: ImageProcessor
}

/**
 * Build the set of domain derivations, closing over the resolved config and
 * loader registry. Config/schemas are captured here (not engine inputs): a
 * config change creates a fresh builder/engine epoch, so they never need hashing.
 *
 * Runtime capabilities are direct second-level dependencies: coarse enough to
 * avoid function-level wiring noise, explicit enough to keep the boundary clear.
 */
export const createPipeline = ({ config, loaders, fs, image }: PipelineDeps): Pipeline => {
  const matchers = new Map<string, Matcher>(config.collections.map(c => [c.name, createMatcher(c.include, c.exclude)]))
  const sources = createSourcesDerivation(config, matchers)
  const load = createLoadDerivation(loaders)
  const asset = createAssetDerivation(config, image)
  const validate = createValidateDerivation(config, load, asset, { fs, image })
  const collect = createCollectDerivation(config, sources, validate)
  const uniqueCheck = createUniqueCheckDerivation(config, sources, validate)
  const emit = createEmitDerivation(config, collect, uniqueCheck)
  return { sources, load, validate, collect, uniqueCheck, emit, asset }
}

export { TREE, fileInput } from './inputs'
export { assetInput, assetKeyOf, publicUrlOf } from './asset'
export { buildProjectInfo } from './validate'
export type { TreeFile } from './inputs'
export type { AssetKey, AssetResult, BlurOptions } from './asset'
