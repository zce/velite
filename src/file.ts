import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'
import { ZodType } from 'zod'

import { load } from './loader'

declare module 'vfile' {
  interface DataMap {
    result: import('./types').Collection
  }
}

export class File extends VFile {
  async parse(schema: ZodType): Promise<void> {
    try {
      if (this.extname == null) {
        throw new Error('can not parse file without extension')
      }

      const original = await load(this)

      if (original == null || Object.keys(original).length === 0) {
        throw new Error('no data parsed from this file')
      }

      const list = Array.isArray(original) ? original : [original]
      const processed = await Promise.all(
        list.map(async (item, index) => {
          const path: (string | number)[] = [this.path]
          if (list.length > 1) path.push(index)
          const result = await schema.safeParseAsync(item, { path })
          if (result.success) return result.data
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
