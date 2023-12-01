import { getConfig } from '../config'
import json from './json'
import matter from './matter'
import yaml from './yaml'

import type { Loader } from '../types'

const builtinLoaders = [json, yaml, matter]

/**
 * resolve loader by filename
 * @param filename load file path
 * @returns loader
 */
export const resolveLoader = (filename: string): Loader | undefined => {
  const { loaders = [] } = getConfig()
  return [...loaders, ...builtinLoaders].find(loader => loader.test.test(filename))
}
