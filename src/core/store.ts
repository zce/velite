/**
 * Typed key for a value stored on a `SessionStore`.
 *
 * Every consumer (typically a schema factory) defines its own key once at
 * module scope and uses it on every parse to fetch the same per-session
 * instance.
 */
export interface StoreKey<T> {
  /** Unique symbol identifying this key. */
  readonly id: symbol
  /** Lazy factory invoked the first time the key is requested in a session. */
  readonly create: () => T
}

/**
 * Define a typed `StoreKey` with a description and a factory.
 *
 * The description is purely informational (used by `Symbol(...)`); equality is
 * symbol identity, so two `defineStoreKey()` calls with the same description
 * produce different keys.
 */
export const defineStoreKey = <T>(description: string, create: () => T): StoreKey<T> => ({
  id: Symbol(description),
  create
})

/**
 * Per-session, typed registry of arbitrary state.
 *
 * Schemas (and other consumers running inside `parseWithContext`) use this to
 * read or lazily create state that should live exactly as long as the current
 * `BuildSession`. The store keeps `ParserContext` stable: adding a new
 * stateful schema does not require changing public types.
 */
export interface SessionStore {
  /** Return the value for `key`, lazily creating it on first access. */
  get<T>(key: StoreKey<T>): T
  /** Whether a value has already been created for `key`. */
  has<T>(key: StoreKey<T>): boolean
}

export const createSessionStore = (): SessionStore => {
  const values = new Map<symbol, unknown>()

  return {
    get<T>(key: StoreKey<T>): T {
      const existing = values.get(key.id)
      if (existing !== undefined) return existing as T
      const created = key.create()
      values.set(key.id, created)
      return created
    },
    has<T>(key: StoreKey<T>): boolean {
      return values.has(key.id)
    }
  }
}
