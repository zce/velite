const cache = new Map<string, any>()

export const setCache = (key: string, value: any) => cache.set(key, value)

export const hasCache = (key: string) => cache.has(key)

export const deleteCache = (key: string) => cache.delete(key)

export const clearCache = () => cache.clear()

export const getCache = <T = any>(key: string, defaults: T): T => {
  if (cache.has(key)) return cache.get(key)
  cache.set(key, defaults)
  return defaults
}
