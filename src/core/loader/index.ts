import { jsonLoader } from './json'
import { matterLoader } from './matter'
import { yamlLoader } from './yaml'

import type { SourcePath } from '../model'
import type { Loader } from './types'

const matches = (loader: Loader, path: SourcePath): boolean =>
  typeof loader.match === 'function' ? loader.match(path) : loader.match.some(ext => path.endsWith(ext))

/** An ordered set of loaders; resolves the first that matches a path. */
export interface LoaderRegistry {
  resolve(path: SourcePath): Loader | undefined
}

export const createLoaderRegistry = (custom: Loader[] = []): LoaderRegistry => {
  // Custom loaders take precedence over built-ins.
  const loaders = [...custom, matterLoader, jsonLoader, yamlLoader]
  return {
    resolve: path => loaders.find(loader => matches(loader, path))
  }
}

export type { Loader, LoaderInput, LoaderResult, LoadedItem } from './types'
