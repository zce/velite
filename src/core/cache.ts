/**
 * Cache registry: in-memory, owner-bound cache for build artifacts.
 *
 * Cache is a performance optimization, never a source of correctness. Every
 * entry records the `owner` (a source/record/asset id) that produced it, so
 * deletion or rename of an owner can clean up exactly its entries. Invalidation
 * is derived from the dependency graph, not from time or size heuristics.
 *
 * The registry is namespaced so distinct cache types (loader, schema, asset,
 * output) never share a key space.
 */

export type CacheNamespace = 'loader' | 'schema' | 'asset' | 'output'

interface CacheEntry {
  readonly value: unknown
  readonly owner: string
  readonly inputs?: ReadonlyArray<string>
}

export interface CacheRegistry {
  /** Read a cached value, or `undefined` when absent. */
  get<T = unknown>(namespace: CacheNamespace, key: string): T | undefined
  /** Store a value under a namespaced key owned by `owner`. */
  set<T = unknown>(namespace: CacheNamespace, owner: string, key: string, value: T, inputs?: string[]): void
  /** Whether a namespaced key exists. */
  has(namespace: CacheNamespace, key: string): boolean
  /** Remove a single entry. */
  delete(namespace: CacheNamespace, key: string): void
  /** Remove every entry owned by `owner`, across all namespaces. */
  invalidateOwner(owner: string): number
  /** Remove every entry in a namespace. */
  invalidateNamespace(namespace: CacheNamespace): number
  /** Remove all entries. */
  clear(): void
}

const compound = (namespace: CacheNamespace, key: string): string => `${namespace} ${key}`

export const createCacheRegistry = (): CacheRegistry => {
  const entries = new Map<string, CacheEntry>()
  const byOwner = new Map<string, Set<string>>()

  const track = (owner: string, key: string): void => {
    let set = byOwner.get(owner)
    if (set == null) {
      set = new Set()
      byOwner.set(owner, set)
    }
    set.add(key)
  }

  return {
    get<T>(namespace: CacheNamespace, key: string): T | undefined {
      return entries.get(compound(namespace, key))?.value as T | undefined
    },

    set(namespace, owner, key, value, inputs) {
      const ck = compound(namespace, key)
      entries.set(ck, { value, owner, inputs: inputs != null ? [...inputs] : undefined })
      track(owner, ck)
    },

    has(namespace, key) {
      return entries.has(compound(namespace, key))
    },

    delete(namespace, key) {
      const ck = compound(namespace, key)
      const entry = entries.get(ck)
      entries.delete(ck)
      if (entry != null) byOwner.get(entry.owner)?.delete(ck)
    },

    invalidateOwner(owner) {
      const keys = byOwner.get(owner)
      if (keys == null) return 0
      const count = keys.size
      for (const ck of keys) entries.delete(ck)
      byOwner.delete(owner)
      return count
    },

    invalidateNamespace(namespace) {
      let count = 0
      const prefix = `${namespace} `
      for (const ck of Array.from(entries.keys())) {
        if (ck.startsWith(prefix)) {
          const entry = entries.get(ck)!
          entries.delete(ck)
          byOwner.get(entry.owner)?.delete(ck)
          count++
        }
      }
      return count
    },

    clear() {
      entries.clear()
      byOwner.clear()
    }
  }
}
