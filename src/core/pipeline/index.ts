import { createMatcher } from '../util/glob'
import { createCollectDerivation } from './collect'
import { createSourcesDerivation } from './discover'
import { createEmitDerivation } from './emit'
import { createLoadDerivation } from './load'
import { createValidateDerivation } from './validate'

import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { LoaderRegistry } from '../loader'
import type { Source } from '../model'
import type { Matcher } from '../util/glob'
import type { Collected, Emitted, Loaded, Validated, ValidateKey } from './types'

export interface Pipeline {
  sources: Derivation<string, Source[]>
  load: Derivation<string, Loaded>
  validate: Derivation<ValidateKey, Validated>
  collect: Derivation<string, Collected>
  emit: Derivation<null, Emitted>
}

/**
 * Build the set of domain derivations, closing over the resolved config and
 * loader registry. Config/schemas are captured here (not engine inputs): a
 * config change creates a fresh builder/engine epoch, so they never need hashing.
 */
export const createPipeline = (config: ResolvedConfig, loaders: LoaderRegistry): Pipeline => {
  const matchers = new Map<string, Matcher>(config.collections.map(c => [c.name, createMatcher(c.include, c.exclude)]))
  const sources = createSourcesDerivation(config, matchers)
  const load = createLoadDerivation(loaders)
  const validate = createValidateDerivation(config, load)
  const collect = createCollectDerivation(config, sources, validate)
  const emit = createEmitDerivation(config, collect)
  return { sources, load, validate, collect, emit }
}

export { TREE, fileInput } from './inputs'
export type { TreeFile } from './inputs'
export type { Pipeline as PipelineDerivations }
