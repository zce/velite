import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'
import { reporter } from 'vfile-reporter'

import { resolveLoader } from './loaders'
import { logger } from './logger'

import type { ZodType } from 'zod'

/**
 * Data entry object
 */
export type Entry = Record<string, unknown>

declare module 'vfile' {
  interface DataMap {
    meta: Entry | Entry[]
    body: string
  }
}

// cache all loaded files for:
// 1. avoid duplicate loading
// 2. reuse in rebuilding
// 3. provide custom schema access
const cache = new Map<string, File>()

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

  get body(): string | undefined {
    return this.data.body
  }

  // get matter() {
  //   return this.data.matter
  // }

  // get markdown() {
  //   return this.value.toString()
  // }

  async load(): Promise<void> {
    try {
      if (this.extname == null) throw new Error('can not load file without extension')
      const loader = resolveLoader(this.path)
      if (loader == null) throw new Error(`no loader found for file '${this.path}'`)
      this.value = await readFile(this.path)
      this.data.original = await loader.load(this)
      this.status = 'loaded'
    } catch (err: any) {
      this.fail(err.message)
    }
  }

  async parse(schema: ZodType): Promise<void> {
    try {
      const { original } = this.data
      if (original == null) throw new Error('no data loaded from this file')
      // may be one or more records in one file, such as yaml array or json array
      const isArr = Array.isArray(original)
      const list = isArr ? original : [original]
      const processed = await Promise.all(
        list.map(async (item, index) => {
          // provide path for error reporting & relative path for reference
          const path: (string | number)[] = [this.path]
          // only push index if list has more than one item
          isArr && path.push(index)
          // parse data with given schema
          const result = await schema.safeParseAsync(item, { path })
          if (result.success) return result.data
          // report error if parsing failed
          result.error.issues.forEach(issue => this.message(issue.message, { source: issue.path.slice(1).join('.') }))
        })
      )
      this.data.parsed = isArr ? processed[0] : processed
      this.status = 'parsed'
    } catch (err: any) {
      this.fail(err.message)
    }
  }

  /**
   * output reference file
   * @param ref reference path
   */
  async outputAsset(ref: string): Promise<void> {
    //
  }
}

/**
 * load file data from path with given schema
 * @param path file path (absolute or relative to cwd)
 * @param schema Zod schema for validation
 * @returns loaded entry or entries (array yml or json)
 */
export const load = async (path: string, schema: ZodType): Promise<Entry | Entries> => {
  const file = new File(path)
  await file.load()
  await file.parse(schema)
  if (file.data.parsed == null) throw new Error(`no data parsed from file '${path}'`)
  // logger.log(`loaded '${this.path}' with ${loader.name} loader, got ${original.length ?? 1} items`)
  return file.data.parsed as Data
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

export type { File }
