import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { VFile } from 'vfile'
import { reporter } from 'vfile-reporter'

import { getConfig } from './config'
import { resolveLoader } from './loaders'
import { logger } from './logger'

import type { ZodSchema } from 'zod'

// cache all loaded files for:
// 1. avoid duplicate loading
// 2. reuse in rebuilding
// 3. provide custom schema access
const cache = new Map<string, File>()

export class File extends VFile {
  constructor(path: string) {
    super({ path })
  }

  async load(): Promise<void> {
    const loader = resolveLoader(this.path)
    if (loader == null) this.fail(`no loader found for file '${this.path}'`)
    this.value = await readFile(this.path)
    this.data = await loader.load(this)
    this.data.assets = this.data.assets ?? {}
  }

  async parse(schema: ZodSchema): Promise<void> {
    const { data } = this.data
    if (data == null) this.fail(`no data loaded from this file`)
    // may be one or more records in one file, such as yaml array or json array
    const isArr = Array.isArray(data)
    const list = isArr ? data : [data]
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
    this.result = isArr ? processed[0] : processed
  }

  /**
   * output reference file
   * @param ref reference path
   */
  async outputAsset(ref: string): Promise<string> {
    const { output } = getConfig()
    const from = join(this.path, '..', ref)
    const source = await readFile(from)
    const filename = output.filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
      const key = groups[0]
      const length = groups[2] == null ? undefined : parseInt(groups[2])
      switch (key) {
        case 'name':
          return basename(ref, extname(ref)).slice(0, length)
        case 'hash':
          // TODO: md5 is slow and not-FIPS compliant, consider using sha256
          // https://github.com/joshwiens/hash-perf
          // https://stackoverflow.com/q/2722943
          // https://stackoverflow.com/q/14139727
          return createHash('md5').update(source).digest('hex').slice(0, length)
        case 'ext':
          return extname(ref).slice(1).slice(0, length)
      }
      return substring
    })
    this.data.assets![filename] = from
    return output.base + filename
  }
}

/**
 * Load file and parse data with given schema
 * @param path file path
 * @param schema data schema
 * @param config resolved config
 */
export const load = async (path: string, schema: ZodSchema): Promise<File> => {
  const file = new File(path)
  cache.set(path, file)
  await file.load()
  await file.parse(schema)
  return file
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
export const report = (): void => {
  const files = Array.from(cache.values())
  const report = reporter(files, { quiet: true })
  report.length > 0 && logger.warn(report)
}
