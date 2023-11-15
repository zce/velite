/**
 * @file Document
 */

import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'
import { ZodType } from 'zod'

import { resolveLoader } from './loaders'

declare module 'vfile' {
  interface DataMap {
    original: Record<string, any> | Record<string, any>[]
    result: Record<string, any> | Record<string, any>[]
  }
}

export class File extends VFile {
  /**
   * load file content into `this.data.original`
   */
  async load(): Promise<void> {
    try {
      if (this.extname == null) {
        throw new Error('can not parse file without extension')
      }
      const loader = resolveLoader(this.path)
      if (loader == null) {
        throw new Error(`no loader found for '${this.path}'`)
      }
      await loader.load(this)
    } catch (err: any) {
      this.message(err.message)
    }
  }

  /**
   * parse `this.data.original` into `this.data.result` with given fields schema
   * @param fields fields schema
   */
  async parse(fields: ZodType): Promise<void> {
    try {
      const { original } = this.data

      if (original == null || Object.keys(original).length === 0) {
        throw new Error('no data parsed from this file')
      }

      const list = Array.isArray(original) ? original : [original]

      const processed = await Promise.all(
        list.map(async (item, index) => {
          // provide path for error reporting & relative path for reference
          const path: (string | number)[] = [this.path]
          // only push index if list has more than one item
          if (list.length > 1) path.push(index)
          // parse data with given schema
          const result = await fields.safeParseAsync(item, { path })
          if (result.success) return result.data
          // report error if parsing failed
          result.error.issues.forEach(issue => {
            this.message(issue.message, { source: issue.path.slice(1).join('.') })
          })
        })
      )

      this.data.result = processed.length === 1 ? processed[0] : processed
    } catch (err: any) {
      this.message(err.message)
    }
  }

  static async create(path: string) {
    const value = await readFile(path, 'utf8')
    return new File({ path, value })
  }
}
