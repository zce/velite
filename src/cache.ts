// memory level cache is enough for Velite. and it's easy & efficient.
// maybe we can use other cache way in the future if needed.
// but for now, we just need a simple cache.

import { VFile } from 'vfile'

/**
 * loaded files, cache all loaded files for:
 * 1. avoid duplicate loading
 * 2. reuse in rebuilding
 * 3. provide custom schema access
 */
export const loaded = new Map<string, VFile>()

/**
 * cache resolved result for rebuild
 */
export const resolved = new Map<string, VFile[]>()

/**
 * cache need refresh in rebuild
 */
export const cache = new Map<string, any>()
