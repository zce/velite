import { getConfig } from '../config'
import json from './json'
import markdown from './markdown'
import yaml from './yaml'

import type { VFile } from 'vfile'

type Promisable<T> = T | PromiseLike<T>

/**
 * File loader
 */
export interface Loader {
  /**
   * Loader name
   * @description
   * The same name will overwrite the built-in loader,
   * built-in loaders: 'json', 'yaml', 'markdown'
   */
  name: string
  /**
   * File test regexp
   * @example
   * /\.md$/
   */
  test: RegExp
  /**
   * Load file content
   * @param vfile vfile
   */
  load: (vfile: VFile) => Promisable<void>
}

declare module '../config' {
  interface PluginConfig {
    /**
     * File loaders
     */
    loaders: Loader[]
  }
}

const builtInloaders: Loader[] = [json, yaml, markdown]

export const addLoader = (loader: Loader): void => {
  const index = builtInloaders.findIndex(item => item.name === loader.name)
  if (index === -1) {
    builtInloaders.unshift(loader)
  } else {
    builtInloaders[index] = loader
  }
}

export const removeLoader = (name: string): void => {
  const index = builtInloaders.findIndex(loader => loader.name === name)
  index !== -1 && builtInloaders.splice(index, 1)
}

export const resolveLoader = (filename: string): Loader | undefined => {
  const { loaders } = getConfig()
  return [...(loaders || []), ...builtInloaders].find(loader => loader.test.test(filename))
}

/**
 * Define a loader (identity function for type inference)
 */
export const defineLoader = (loader: Loader) => loader
