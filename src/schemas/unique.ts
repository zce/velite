import { string } from 'zod'

import { context } from '../runtime/context'

/** Session-scoped store for `s.unique()` value tracking. */
export interface UniqueStore {
  register(group: string, value: string, file: string): string | undefined
  invalidate(file: string): void
}

export const createUniqueStore = (): UniqueStore => {
  const store = new Map<string, string>()
  const fileKeys = new Map<string, Set<string>>()
  const key = (group: string, value: string): string => `${group}\u0000${value}`

  return {
    register(group, value, file) {
      const k = key(group, value)
      const existing = store.get(k)
      if (existing != null) return existing
      store.set(k, file)
      let keys = fileKeys.get(file)
      if (keys == null) {
        keys = new Set()
        fileKeys.set(file, keys)
      }
      keys.add(k)
      return undefined
    },
    invalidate(file) {
      const keys = fileKeys.get(file)
      if (keys == null) return
      for (const k of keys) store.delete(k)
      fileKeys.delete(file)
    }
  }
}

export const uniqueStoreKey = Symbol('velite.unique')

/**
 * Generate a unique-value schema.
 *
 * Validates that `value` has not been registered with the same `group` in the
 * current build session. The session-scoped `UniqueStore` guarantees that
 * independent builds never see each other's values.
 *
 * @param group unique group namespace (default `'global'`).
 */
export const unique = (group: string = 'global') =>
  string().superRefine((value, ctx) => {
    const { file, store } = context()
    const conflict = store.getOrCreate(uniqueStoreKey, createUniqueStore).register(group, value, file.path)
    if (conflict != null) {
      ctx.addIssue({ fatal: true, code: 'custom', message: `Duplicate '${value}' with '${conflict}'` })
    }
  })
