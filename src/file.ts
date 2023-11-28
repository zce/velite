import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'

import { resolveLoader } from './loaders'
import { logger } from './logger'

import type { ZodType } from 'zod'

/**
 * Entry from file
 */
export type Entry = Record<string, any>

declare module 'vfile' {
  interface DataMap {
    /**
     * Data from file (before parsing)
     * @description
     * There may be one or more entries in a document file
     */
    original: Entry | Entry[]
    /**
     * Data from file (after parsing)
     * @description
     * There may be one or more entries in a document file
     */
    parsed: Entry | Entry[]
  }
}

/**
 * load file data into `file.data.original`
 */
const load = async (file: VFile): Promise<void> => {
  file.value = await readFile(file.path, 'utf8')

  if (file.extname == null) {
    throw new Error('can not parse file without extension')
  }

  const loader = resolveLoader(file.path)
  if (loader == null) {
    throw new Error(`no loader found for '${file.path}'`)
  }

  logger.log(`load file '${file.path}' with '${loader.name}' loader`)

  loader.load(file)
}

/**
 * parse file with given schema
 * @param path file path
 * @param schema Zod schema
 * @returns file instance with parsed data
 */
export const parse = async (path: string, schema: ZodType): Promise<VFile> => {
  const file = new VFile({ path })
  try {
    await load(file)

    const { original } = file.data

    if (original == null || Object.keys(original).length === 0) {
      throw new Error('no data parsed from this file')
    }

    // there may be one or more records in one file, such as yaml array or json array
    const isArr = Array.isArray(original)
    const list = isArr ? original : [original]

    const processed = await Promise.all(
      list.map(async (item, index) => {
        // provide path for error reporting & relative path for reference
        const path: (string | number)[] = [file.path]
        // only push index if list has more than one item
        isArr && path.push(index)
        // parse data with given schema
        const result = await schema.safeParseAsync(item, { path })
        if (result.success) return result.data
        // report error if parsing failed
        result.error.issues.forEach(issue => {
          file.message(issue.message, { source: issue.path.slice(1).join('.') })
        })
      })
    )

    file.data.parsed = isArr ? processed[0] : processed
  } catch (err: any) {
    file.message(err.message)
  }
  return file
}
