import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'

import { resolveLoader } from './loaders'

import type { Collection } from './types'
import type { ZodType } from 'zod'

export class File extends VFile {
  /**
   * create file instance
   * @param path file path
   * @returns file instance
   */
  static async create(path: string) {
    const value = await readFile(path, 'utf8')
    return new File({ path, value })
  }

  /**
   * load file content into `this.data.original`
   * @returns original data from file
   */
  private async load(): Promise<Collection> {
    if (this.extname == null) {
      throw new Error('can not parse file without extension')
    }
    const loader = resolveLoader(this.path)
    if (loader == null) {
      throw new Error(`no loader found for '${this.path}'`)
    }
    return loader.load(this)
  }

  /**
   * parse file content with given fields schema
   * @param fields fields schema
   * @returns collection data from file, or undefined if parsing failed
   */
  async parse(fields: ZodType): Promise<Collection | undefined> {
    try {
      const original = await this.load()

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

      return processed.length === 1 ? processed[0] : processed
    } catch (err: any) {
      this.message(err.message)
    }
  }
}
