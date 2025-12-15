import { string } from 'zod'

import { context } from '../context'

class UniqueCache {
  private readonly store = new Map<string, string>()

  set(group: string, value: string, path: string) {
    this.store.set(`${group}:${value}`, path)
  }

  get(group: string, value: string) {
    return this.store.get(`${group}:${value}`)
  }

  reset(path?: string) {
    if (path == null) {
      this.store.clear()
      return
    }
    for (const [key, value] of this.store.entries()) {
      if (value === path) this.store.delete(key)
    }
  }
}

export const uniqueCache = new UniqueCache()

/**
 * generate a unique schema
 * @param group unique by
 * @returns unique schema
 */
export const unique = (group: string = 'global') =>
  string().superRefine((value, ctx) => {
    const conflict = uniqueCache.get(group, value)
    if (conflict) {
      ctx.addIssue({ fatal: true, code: 'custom', message: `Duplicate '${value}': already exists in '${conflict}'` })
    } else {
      uniqueCache.set(group, value, context().file.path)
    }
  })
