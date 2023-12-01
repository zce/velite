import json from './json'
import matter from './matter'
import yaml from './yaml'

import type { VFile } from 'vfile'

type Entry = Record<string, any>
type Promisable<T> = T | Promise<T>
type Load = (file: VFile) => Promisable<Entry | Entry[] | undefined>

/**
 * File loader
 */
export interface Loader {
  /**
   * Loader name
   * @description
   * The same name will overwrite the built-in loader,
   * built-in loaders: 'json', 'yaml', 'matter'
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
   * @param file vfile
   * @returns entry or entries
   */
  load: Load
}

const loaders: Loader[] = [json, yaml, matter]

/**
 * add custom loaders
 * @param list custom loaders
 */
export const addLoader = (...list: Loader[]): void => {
  list.forEach(loader => {
    const index = loaders.findIndex(item => item.name === loader.name)
    if (index === -1) loaders.unshift(loader)
    else loaders[index] = loader
  })
}

/**
 * remove loader by name
 * @param name loader name
 */
export const removeLoader = (name: string): void => {
  const index = loaders.findIndex(loader => loader.name === name)
  index !== -1 && loaders.splice(index, 1)
}

/**
 * resolve loader by filename
 * @param filename load file path
 * @returns loader
 */
export const resolveLoader = (filename: string): Loader | undefined => {
  return loaders.find(loader => loader.test.test(filename))
}

/**
 * load file
 * @param file file need to load
 * @returns result
 */
export const loadFile: Load = async file => {
  const loader = resolveLoader(file.path)
  if (loader == null) throw new Error(`no loader found for '${file.path}'`)
  return await loader.load(file)
}

/**
 * Define a loader (identity function for type inference)
 */
export const defineLoader = (loader: Loader) => loader
