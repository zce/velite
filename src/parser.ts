import { AsyncLocalStorage } from 'node:async_hooks'

import type { ZodType } from 'zod'
import type { VeliteFile } from './file'
import type { Config } from './types'

type Context = {
  file: VeliteFile
  config: Config
}

const contextStore = new AsyncLocalStorage<Context>()

export const currentFile = (): VeliteFile => {
  const context = contextStore.getStore()
  if (!context) throw new Error('Missing parser context')
  return context.file
}

export const currentConfig = (): Config => {
  const context = contextStore.getStore()
  if (!context) throw new Error('Missing parser context')
  return context.config
}

/**
 * Run safeParse with file injected.
 */
export const parseWithFile = async (schema: ZodType, data: unknown, config: Config, file: VeliteFile) => {
  return contextStore.run({ file, config }, () => schema.safeParseAsync(data))
}
