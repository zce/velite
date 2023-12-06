import { readFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import { VFile } from 'vfile'

import { resolveLoader } from './loaders'
import { logger } from './logger'

import type { ZodSchema } from 'zod'

declare module 'vfile' {
  interface DataMap {
    /**
     * original data loaded from file
     */
    data: unknown
    /**
     * content excerpt
     */
    excerpt: string
    /**
     * content without frontmatter
     */
    content: string
  }
}

// cache all loaded files for:
// 1. avoid duplicate loading
// 2. reuse in rebuilding
// 3. provide custom schema access
const cache = new Map<string, File>()

class File extends VFile {
  constructor(path: string) {
    super({ path })
  }

  async load(): Promise<void> {
    const loader = resolveLoader(this.path)
    if (loader == null) this.fail(`no loader found for '${this.path}'`)
    this.value = await readFile(this.path)
    this.data = await loader.load(this)
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
}

/**
 * Load file and parse data with given schema
 * @param path file path
 * @param schema data schema
 * @param config resolved config
 */
export const load = async (path: string, schema: ZodSchema, changed?: string): Promise<File> => {
  path = normalize(path)
  if (changed != null && path !== changed && cache.has(path)) {
    // skip file if changed file not match
    logger.log(`skipped load '${path}', using previous loaded`)
    return cache.get(path)!
  }
  const begin = performance.now()
  const file = new File(path)
  cache.set(path, file)
  await file.load()
  await file.parse(schema)
  logger.log(`loaded '${path}' with ${(file.result as any).length ?? 1} records`, begin)
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
