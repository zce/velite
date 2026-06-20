import { jsonLoader } from './json'
import { matterLoader } from './matter'
import { yamlLoader } from './yaml'

export type { Loader, LoaderContext, LoaderRecord, LoaderResult, LoaderSource, Promisable } from './types'
export { defineLoader, matchesLoader } from './types'

/** Built-in loaders, applied in order after any user-supplied loaders. */
export const builtinLoaders = [jsonLoader, yamlLoader, matterLoader]
