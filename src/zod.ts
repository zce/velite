import { AsyncLocalStorage } from 'node:async_hooks'
import * as z from 'zod'

import { logger } from './logger'

import type { RefinementCtx, ZodType as ZodTypeBase } from 'zod'
import type { VeliteFile } from './file'

const fileStore = new AsyncLocalStorage<VeliteFile>()

const withFileCtx =
  <In, Out>(fn: (data: In, ctx: RefinementCtx) => Out) =>
  (data: In, ctx: RefinementCtx): Out => {
    const file = fileStore.getStore()
    if (!file) throw new Error('Missing file context for validation')
    if (ctx.file == null) {
      Object.defineProperty(ctx, 'file', { get: () => file, enumerable: false })
    }
    if (ctx.meta == null) {
      Object.defineProperty(ctx, 'meta', { get: () => file, enumerable: false })
    }
    return fn(data, ctx)
  }

// patch transform/superRefine to attach ctx.meta automatically
const originalTransform = z.ZodType.prototype.transform
z.ZodType.prototype.transform = function (this: ZodTypeBase, fn: (data: any, ctx: RefinementCtx) => any) {
  return originalTransform.call(this, withFileCtx(fn))
}

const originalSuperRefine = z.ZodType.prototype.superRefine
z.ZodType.prototype.superRefine = function (this: ZodTypeBase, fn: (data: any, ctx: RefinementCtx) => any) {
  return originalSuperRefine.call(this, withFileCtx(fn))
}

/**
 * Run safeParse with file injected.
 */
export const parseWithFile = async (schema: z.ZodType, data: unknown, file: VeliteFile) =>
  fileStore.run(file, () => {
    const originalRun = schema._zod.run
    schema._zod.run = (data, ctx) => {
      const file = fileStore.getStore()
      logger.info(`Running schema: ${file?.config.cache}`)
      if (!('file' in data)) {
        Object.defineProperty(ctx, 'file', { get: () => file, enumerable: false })
      }
      if (!('meta' in data)) {
        Object.defineProperty(data, 'meta', { get: () => file, enumerable: false })
      }
      return originalRun.call(schema._zod, data, ctx)
    }
    return schema.safeParseAsync(data)
  })

export { z }
export type Schema = z.ZodType
export type ZodType = z.ZodType
export type infer<T extends z.ZodType> = z.infer<T>
export * from 'zod'

declare module 'zod' {
  interface RefinementCtx {
    file: VeliteFile
    /**
     * @deprecated Use `file` instead.
     */
    meta: VeliteFile // backward-compatible alias
  }
}
