import { diagnostic } from '../diagnostic'
import { fileInput } from './inputs'

import type { Derivation } from '../engine'
import type { LoaderRegistry } from '../loader'
import type { RawEntry } from '../model'
import type { Loaded } from './types'

const decoder = new TextDecoder()

/**
 * `load(path)` → raw entries parsed from a source. Pure: reads the file bytes
 * input and runs the matching loader. No schema validation.
 */
export const createLoadDerivation = (loaders: LoaderRegistry): Derivation<string, Loaded> => ({
  name: 'load',
  compute(context, path) {
    const bytes = context.input<Uint8Array>(fileInput(path))
    const loader = loaders.resolve(path)
    if (loader === undefined) {
      return { entries: [], diagnostics: [diagnostic('error', 'LOADER_FAILED', `no loader for ${path}`, { stage: 'load', file: path })] }
    }
    const result = loader.load({ path, bytes, text: decoder.decode(bytes) })
    const entries: RawEntry[] = result.items.map(item => ({
      id: `${path}#${item.key}`,
      source: path,
      key: item.key,
      data: item.data,
      ...(item.meta ? { meta: item.meta } : {})
    }))
    return { entries, diagnostics: result.diagnostics ?? [] }
  }
})
