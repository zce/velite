export type StoreKey = string | symbol

/**
 * Per-session, typed registry of arbitrary state.
 *
 * Schemas (and other consumers running inside `context()`) use this to
 * read or lazily create state that should live exactly as long as the current
 * `BuildSession`. The store keeps `ParserContext` stable: adding a new
 * stateful schema does not require changing public types.
 */
export interface SessionStore {
  /** Return the value for `key` if it has been set. */
  get<T>(key: StoreKey): T | undefined
  /** Set the value for `key`. */
  set<T>(key: StoreKey, value: T): void
  /** Return the value for `key`, lazily creating it on first access. */
  getOrCreate<T>(key: StoreKey, create: () => T): T
  /** Whether a value has already been set for `key`. */
  has(key: StoreKey): boolean
}

export const createSessionStore = (): SessionStore => {
  const values = new Map<StoreKey, unknown>()

  return {
    get<T>(key: StoreKey): T | undefined {
      return values.get(key) as T | undefined
    },
    set<T>(key: StoreKey, value: T): void {
      values.set(key, value)
    },
    getOrCreate<T>(key: StoreKey, create: () => T): T {
      if (values.has(key)) return values.get(key) as T
      const created = create()
      values.set(key, created)
      return created
    },
    has(key: StoreKey): boolean {
      return values.has(key)
    }
  }
}
