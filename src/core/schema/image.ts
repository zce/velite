// `s.image()` schema: resolves a content-relative image reference into an
// `ImageData` (public url + dimensions + blur placeholder), emitting an
// `AssetReferenceEffect` so the driver copies the file and the two-pass asset
// flow can resolve its content-hashed url and probed metadata.
//
// Ported from the pre-refactor `src/schemas/image.ts`, adapted to the new
// schema context (`context().asset(assetKey)` + `collectEffect`) and the
// engine-driven asset derivation. The no-sharp degradation (runtime without an
// image processor) is handled inside the asset derivation: it returns a real
// content-hashed url with zero metadata, so `s.image` produces an `ImageData`
// with zeros — no crash, no diagnostic. The driver/runtime is responsible for
// providing an `ImageProcessor` when image metadata is required.

import { z } from 'zod'

import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'

/** Image object with metadata & blur placeholder. */
export interface ImageData {
  /** Public url of the image. */
  src: string
  /** Image width (0 when no image processor is available). */
  width: number
  /** Image height (0 when no image processor is available). */
  height: number
  /** Blur placeholder data url (empty when no image processor is available). */
  blurDataURL: string
  /** Blur image width (0 when no image processor is available). */
  blurWidth: number
  /** Blur image height (0 when no image processor is available). */
  blurHeight: number
}

/** Options for the {@link image} schema. */
export interface ImageSchemaOptions {
  // Reserved for future options (e.g. absoluteRoot). None active in M5: the
  // schema resolves content-relative references through the asset pipeline.
}

/**
 * An image path relative to the current file, copied into the asset output and
 * resolved to an {@link ImageData} (public url + probed dimensions + blur
 * placeholder). The metadata comes from the engine's memoized asset derivation,
 * so it benefits from backdating and the two-pass driver flow.
 *
 * Note: unlike `s.file`, non-relative values (URLs, absolute paths) are NOT
 * passed through — `s.image` always treats its value as content-relative. The
 * pre-refactor `absoluteRoot` option for `/`-prefixed paths is deferred. This
 * matches the pre-refactor `s.image` behavior for URLs (also non-passthrough).
 */
export const image = (_options: ImageSchemaOptions = {}): z.ZodType<ImageData> =>
  z.string().transform<ImageData>(async (value, ctx) => {
    try {
      const { project, file, record, asset, collectEffect } = context()
      const absSourcePath = join(dirname(file.path), stripQueryAndHash(value))
      const assetKey = assetKeyOf(absSourcePath, project.root)
      const result = await asset(assetKey)
      collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, isImage: true })
      return {
        src: result.publicUrl,
        width: result.width,
        height: result.height,
        blurDataURL: result.blurDataURL,
        blurWidth: result.blurWidth,
        blurHeight: result.blurHeight
      }
    } catch (err) {
      ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
      return null as never
    }
  })
