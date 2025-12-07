import { AsyncLocalStorage } from 'node:async_hooks'

import type { ZodType } from 'zod'
import type { VeliteFile } from '../file'

const fileStore = new AsyncLocalStorage<VeliteFile>()

export const currentFile = (): VeliteFile => {
  const file = fileStore.getStore()
  if (!file) throw new Error('Missing file context for validation')
  return file
}

/**
 * Run safeParse with file injected.
 */
export const parseWithFile = async (schema: ZodType, data: unknown, file: VeliteFile) => fileStore.run(file, () => schema.safeParseAsync(data))
