// memory level cache is enough for Velite. and it's easy & efficient.
// maybe we can use other cache way in the future if needed.
// but for now, we just need a simple cache.

const store = new Map<string, any>()

type Key = `REFRESH:${string}` | `${string}:${string}`

/**
 * get cache value
 * @param key cache key
 * @param defaults default value
 * @returns get cache value, if not exists, set defaults and return defaults
 */
const get = <T>(key: Key, defaults?: T): typeof defaults => {
  if (store.has(key)) return store.get(key)
  store.set(key, defaults)
  return defaults
}

/**
 * set cache value
 * @param key cache key, namespace is required, start with `REFRESH:` will be auto cleard when rebuild
 * @param value
 * @returns
 */
const set = (key: Key, value: any) => store.set(key, value)

/**
 *
 * @param key cache key, namespace is recommended, add `refreshed:`
 * @returns
 */
const has = (key: Key) => store.has(key)

/**
 * clear cache
 * @param prefix cache key prefix
 */
const clear = (prefix?: string) => {
  if (prefix) {
    const keys = Array.from(store.keys()).filter(key => key.startsWith(prefix))
    for (const key of keys) store.delete(key)
  } else {
    store.clear()
  }
}

export const cache = { get, set, has, clear }
