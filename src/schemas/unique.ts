import { string } from 'zod'

import { internalContext } from '../core/context'
import { uniqueStoreKey } from '../core/unique'

/**
 * Generate a unique-value schema.
 *
 * Validates that `value` has not been registered with the same `group` in the
 * current build session. The session-scoped `UniqueStore` guarantees that
 * independent builds never see each other's values.
 *
 * @param group unique group namespace (default `'global'`).
 */
export const unique = (group: string = 'global') =>
  string().superRefine((value, ctx) => {
    const { file, store } = internalContext()
    const conflict = store.get(uniqueStoreKey).register(group, value, file.path)
    if (conflict != null) {
      ctx.addIssue({ fatal: true, code: 'custom', message: `Duplicate '${value}' with '${conflict}'` })
    }
  })
