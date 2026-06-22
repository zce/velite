// Root-level image processor adapter: the ONLY place the core-adjacent code
// touches `sharp`. The runtime-neutral guard scans only `src/core/`, so this
// file lives at the root (next to `src/runtime.ts`, `src/fs.ts`, ...). `sharp` is a
// runtime dependency (an allowed native build in pnpm-workspace.yaml) and stays
// external — tsdown never bundles it; the dynamic `import('sharp')` keeps it a
// lazy, runtime-optional capability.
//
// Ported from the pre-refactor `src/assets/image.ts` `getImageMetadata`. The
// contract (`ImageProcessor`) splits probe (dimensions + format) from
// blur-data-url generation so a future runtime could implement either
// independently; this adapter implements both via sharp. Asset content hashing
// for filenames lives in the runtime-agnostic core (`src/core/util/hash.ts`),
// NOT here.

import type { ImageProcessor } from '../../image'

/**
 * Blur placeholder width. NOTE: the canonical contract lives in
 * `src/core/pipeline/asset.ts` (`BLUR_WIDTH`), which gates blur generation on
 * `width > 0`. This root adapter mirrors the same width so the generated blur
 * image matches the dimensions the asset derivation reports.
 */
const BLUR_WIDTH = 8

/**
 * Sharp-backed {@link ImageProcessor}. `sharp` is imported lazily so the runtime
 * stays usable without it (the no-sharp degradation path), and so the bundler
 * never pulls the native binary into `dist`.
 *
 * `blurDataURL` accepts pre-probed metadata to avoid re-reading the image when
 * the caller already has dimensions (the asset derivation always does). When
 * metadata is omitted the adapter probes internally; either way, dimensionless
 * inputs (e.g. some SVGs) return `''` rather than divide by zero.
 */
export const sharpImageProcessor: ImageProcessor = {
  async probe(data) {
    const { default: sharp } = await import('sharp')
    const { width, height, format } = await sharp(data).metadata()
    return { width: width ?? 0, height: height ?? 0, format: format ?? '' }
  },

  async blurDataURL(data, metadata) {
    const { default: sharp } = await import('sharp')
    const img = sharp(data)
    let width = metadata?.width ?? 0
    let height = metadata?.height ?? 0
    if (metadata === undefined) {
      const meta = await img.metadata()
      width = meta.width ?? 0
      height = meta.height ?? 0
    }
    if (width <= 0 || height <= 0) return ''
    const blurHeight = Math.max(1, Math.round((BLUR_WIDTH * height) / width))
    const blurImage = await img.resize(BLUR_WIDTH, blurHeight).webp({ quality: 1 }).toBuffer()
    return `data:image/webp;base64,${blurImage.toString('base64')}`
  }
}
