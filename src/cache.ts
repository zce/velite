// memory level cache is enough for Velite. and it's easy & efficient.
// maybe we can use other cache way in the future if needed.
// but for now, we just need a simple cache.

/**
 * cache need refresh in rebuild
 */
export const cache = new Map<string, any>()
