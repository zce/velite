import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'
import { reporter } from 'vfile-reporter'

import { loadFile } from './loaders'
import { logger } from './logger'

import type { ZodType } from 'zod'

// cache all loaded files for:
// 1. avoid duplicate loading
// 2. reuse in rebuilding
// 3. provide custom schema access
const cache = new Map<string, File>()

type Entry = Record<string, unknown>

declare module 'vfile' {
  interface DataMap {
    original: Entry | Entry[]
    parsed: Entry | Entry[]
  }
}

class File extends VFile {
  /**
   * file status
   * - initial: just created, only path is available
   * - loaded: value is loaded
   * - parsed: value is parsed
   * - transformed: value is transformed
   * - outputed: value is outputed
   * - updated: value is updated
   */
  private status: 'initial' | 'loaded' | 'parsed' | 'transformed' | 'outputed' | 'updated'

  constructor(path: string) {
    super({ path })
    this.status = 'initial'
    cache.set(path, this)
  }

  get matter() {
    return this.data.matter
  }

  get markdown() {
    return this.value.toString()
  }

  async load() {
    try {
      this.value = await readFile(this.path)
      this.data.original = await loadFile(this)
      this.status = 'loaded'
    } catch (err: any) {
      this.fail(err.message)
    }
  }

  async parse() {
    try {
      // this.data.matter = matter(this.value.toString())
      this.status = 'parsed'
    } catch (err: any) {
      this.fail(err.message)
    }
  }

  async transform() {}

  async outputAsset() {}

  static async create(path: string) {}
}

/**
 * load file entry from path
 * @param path file path (absolute or relative to cwd)
 * @param schema Zod schema for validation
 * @returns loaded entry or entries (array yml or json)
 */
export const load = async (path: string, schema: ZodType): Promise<Entry | Entry[]> => {
  const file = new File(path)
  await file.load()
  await file.parse()
  return []
}

/**
 * get loaded file from cache
 * @param path loaded file path (absolute or relative to cwd)
 * @returns loaded file
 */
export const getFile = (path: string): File => {
  if (cache.has(path)) return cache.get(path)!
  throw new Error(`file ${path} is not loaded`)
}

/**
 * report all files if any error in parsing
 */
export const report = () => {
  const files = Array.from(cache.values())
  const report = reporter(files, { quiet: true })
  report.length > 0 && logger.warn(report)
}
