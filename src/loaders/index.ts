import { context } from '../context'
import json from './json'
import matter from './matter'
import yaml from './yaml'

import type { Loader } from '../config'

const builtinLoaders = [json, yaml, matter]

/**
 * resolve loader by filename
 * @param filename load file path
 * @returns loader
 */
export const resolveLoader = (filename: string): Loader | undefined => {
  const { loaders = [] } = context
  return [...loaders, ...builtinLoaders].find(loader => loader.test.test(filename))
}
