import { string } from './zod'

import type { Config } from '../types'

/**
 * Internal cache for tracking unique values across schema parsing
 */
class UniqueCache {
  private key(group: string, value: string): string {
    return `schemas:unique:${group}:${value}`
  }

  /**
   * Register a value in a group
   * @param config resolved config
   * @param group unique group name
   * @param value the value to register
   * @param path file path where the value was found
   */
  set(config: Config, group: string, value: string, path: string): void {
    config.cache.set(this.key(group, value), path)
  }

  /**
   * Check if a value exists in a group
   * @param config resolved config
   * @param group unique group name
   * @param value the value to check
   * @returns file path where the value was first registered, or undefined
   */
  get(config: Config, group: string, value: string): string | undefined {
    return config.cache.get(this.key(group, value))
  }

  /**
   * Reset the cache
   * @param config resolved config
   * @param path if provided, only clear entries from this file path; otherwise clear all
   */
  reset(config: Config, path?: string): void {
    if (path == null) {
      for (const key of config.cache.keys()) {
        if (key.startsWith('schemas:unique:')) config.cache.delete(key)
      }
      return
    }

    for (const [key, value] of config.cache.entries()) {
      if (key.startsWith('schemas:unique:') && value === path) config.cache.delete(key)
    }
  }
}

/**
 * Shared unique cache instance
 */
export const uniqueCache = new UniqueCache()

/**
 * Generate a unique schema
 * @param group unique group name
 * @returns unique schema
 */
export const unique = (group: string = 'global') =>
  string().superRefine((value, { meta, addIssue }) => {
    const conflict = uniqueCache.get(meta.config, group, value)
    if (conflict) {
      addIssue({ fatal: true, code: 'custom', message: `duplicate value '${value}' in '${meta.path}' (conflicts with '${conflict}')` })
    } else {
      uniqueCache.set(meta.config, group, value, meta.path)
    }
  })
