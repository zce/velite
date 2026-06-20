import type { SessionStore } from './session'

/**
 * Create a session-scoped store backed by an in-memory map.
 *
 * The store deliberately exposes only `get` / `has` / `getOrCreate`: there is
 * no `set()`. Built-in cross-file schemas use the internal schema-effects model
 * instead of mutating shared state, so user schemas only get a lazy-init path.
 * The store is destroyed with the session (or reset on config reload, which
 * creates a fresh session) — it never needs explicit mutation from the outside.
 */
export const createSessionStore = (): SessionStore => {
  const values = new Map<string | symbol, unknown>()

  return {
    get<T>(key: string | symbol): T | undefined {
      return values.get(key) as T | undefined
    },
    has(key: string | symbol): boolean {
      return values.has(key)
    },
    getOrCreate<T>(key: string | symbol, create: () => T): T {
      if (values.has(key)) return values.get(key) as T
      const created = create()
      values.set(key, created)
      return created
    }
  }
}
