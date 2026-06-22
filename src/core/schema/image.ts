// `s.image()` schema: resolves a content-relative image reference into an
// `ImageData` (public url + dimensions + blur placeholder), emitting an
// `AssetReferenceEffect` so the driver copies the file and the two-pass asset
// flow can resolve its content-hashed url and probed metadata.
//
// Three options are supported:
//   - `absoluteRoot` lets `/`-prefixed paths resolve against an absolute filesystem
//     root (e.g. the project's `public/` dir). These paths bypass the asset
//     pipeline — the schema reads + probes directly via the schema context's
//     `readFile` / `probeImage` closures (no asset copy, no content-hashed url).
//   - `blur` customises the generated blur placeholder (width/height/quality).
//   - `outputName` overrides the global `output.name` filename template for
//     this specific schema invocation.
//
// Ported from the pre-refactor `src/schemas/image.ts`. The no-sharp degradation
// (runtime without an image processor) is handled inside the asset derivation
// AND the `probeImage` closure: both return zero metadata so `s.image` produces
// an `ImageData` with zeros — no crash, no diagnostic.

import { z } from 'zod'

import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'

import type { BlurOptions } from '../pipeline/asset'

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
  /**
   * Root path for absolute `/`-prefixed paths. When set, a `value` like
   * `/logo.png` is read from `join(absoluteRoot, value)` and returned verbatim
   * (no asset copy, no content-hashed url) with probed metadata. Useful for
   * referencing static files served from `public/`.
   */
  absoluteRoot?: string
  /** Blur placeholder options (width / height / quality). */
  blur?: BlurOptions
  /**
   * Per-schema override of the global `output.name` template.
   * Supports `[name]`, `[hash]`, `[hash:N]`, `[ext]`, and `/` for subdirectories.
   * @example 'logos/[name]-[hash:6].[ext]'
   */
  outputName?: string
}

/**
 * An image path relative to the current file (or absolute, when `absoluteRoot`
 * is set), resolved to an {@link ImageData} (public url + probed dimensions +
 * blur placeholder).
 */
export const image = ({ absoluteRoot, blur, outputName }: ImageSchemaOptions = {}): z.ZodType<ImageData> =>
  z.string().transform<ImageData>(async (value, ctx) => {
    try {
      const { project, file, record, asset, collectEffect, readFile, probeImage } = context()

      // Absolute-path branch: read directly, probe directly, return value as-is.
      if (absoluteRoot !== undefined && value.startsWith('/')) {
        const bytes = await readFile(join(absoluteRoot, stripQueryAndHash(value)))
        const metadata = await probeImage(bytes, blur)
        return { src: value, ...metadata }
      }

      // Relative path branch: go through the asset derivation (two-pass).
      const absSourcePath = join(dirname(file.path), stripQueryAndHash(value))
      const assetKey = assetKeyOf(absSourcePath, project.root)
      const template = outputName ?? project.output.name
      const result = await asset(assetKey, { template, blur })
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
