import { string } from 'zod'

import { context } from '../context'

/**
 * Internal cache for tracking unique values across schema parsing.
 */
class UniqueCache {
  private key(group: string, value: string): string {
    return `schemas:unique:${group}:${value}`
  }

  private readonly store = new Map<string, string>()

  /**
   * Register a value in a group.
   */
  set(group: string, value: string, path: string): void {
    this.store.set(this.key(group, value), path)
  }

  /**
   * Check if a value exists in a group.
   */
  get(group: string, value: string): string | undefined {
    return this.store.get(this.key(group, value))
  }

  /**
   * Reset the cache.
   */
  reset(path?: string): void {
    if (path == null) return this.store.clear()

    for (const [key, value] of this.store.entries()) {
      if (key.startsWith('schemas:unique:') && value === path) this.store.delete(key)
    }
  }
}

export const uniqueCache = new UniqueCache()

/**
 * Generate a unique schema.
 * @param group unique group name
 * @returns unique schema
 */
export const unique = (group: string = 'global') =>
  string().superRefine((value, ctx) => {
    const path = context().file.path
    const conflict = uniqueCache.get(group, value)
    if (conflict) {
      ctx.addIssue({ fatal: true, code: 'custom', message: `Duplicate '${value}' with '${conflict}'` })
    } else {
      uniqueCache.set(group, value, path)
    }
  })
