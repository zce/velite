import { defineStoreKey } from './store'

/**
 * Session-scoped store for unique value tracking.
 *
 * Replaces the previous module-level `uniqueCache`. Values are namespaced by
 * `group`, matching `s.unique(group)` semantics. `register()` returns the
 * conflicting file path when the value was previously registered, or
 * `undefined` after a successful registration.
 */
export interface UniqueStore {
  register(group: string, value: string, file: string): string | undefined
}

export const createUniqueStore = (): UniqueStore => {
  const store = new Map<string, string>()
  const key = (group: string, value: string): string => `${group}\u0000${value}`

  return {
    register(group, value, file) {
      const k = key(group, value)
      const existing = store.get(k)
      if (existing != null) return existing
      store.set(k, file)
      return undefined
    }
  }
}

/** Store key used by `s.unique()`. */
export const uniqueStoreKey = defineStoreKey('velite.unique', createUniqueStore)
