import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as z from 'zod'

import { processAsset } from '../assets/process'
import { getContext } from './context'

import type { ImageBlurOptions, ImageData, ImageOptions } from '../assets/image'

export type { ImageBlurOptions, ImageData, ImageOptions }

/** Image schema. Resolves a content-relative image into `ImageData`. */
export const image = ({ absoluteRoot, blur }: ImageOptions = {}): z.ZodType<ImageData> =>
  z.string().transform<ImageData>(async (value, ctx) => {
    try {
      if (absoluteRoot != null && /^\//.test(value)) {
        const { getImageMetadata } = await import('../assets/image')
        const buffer = await readFile(join(absoluteRoot, value))
        const metadata = await getImageMetadata(buffer, blur)
        if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
        return { src: value, ...metadata }
      }
      const { file, project, assetStore, assetCache, record, collectEffect } = getContext()
      const result = await processAsset({
        input: value,
        from: file.path,
        filename: project.output.name,
        baseUrl: project.output.base,
        assets: assetStore,
        cache: assetCache,
        isImage: true,
        blur
      })
      collectEffect({ type: 'asset', owner: record.id, assetPath: result.sourcePath, publicUrl: result.publicUrl, isImage: true })
      return { src: result.publicUrl, ...(result.image as Omit<ImageData, 'src'>) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
