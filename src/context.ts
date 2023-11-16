import type { Output } from './types'

let outputConfig: Output | null = null

/**
 * set output config, required to call before output
 * @param output output config
 */
export const initOutputConfig = (output: Output): void => {
  outputConfig = output
}

/**
 * get output config, throw error if not initialized
 * @returns output config
 */
export const getOutputConfig = (): Output => {
  if (outputConfig == null) {
    throw new Error('output config not initialized')
  }
  return outputConfig
}

export const cache = new Map<string, any>()

// export const getCache = <T = any>(key: string): T => cache.get(key)
// export const setCache = (key: string, value: any) => cache.set(key, value)
// export const hasCache = (key: string) => cache.has(key)
// export const deleteCache = (key: string) => cache.delete(key)
// export const clearCache = () => cache.clear()
