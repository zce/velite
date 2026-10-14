// Asset derivation: the memoized, backdating-friendly bridge from raw asset
// bytes to the public-url + image metadata that schemas (`s.image` / `s.file`)
// consume. This is the core of the two-pass asset model (see the driver's
// `emitAndWrite` for the orchestrating flow).
//
// The chicken-and-egg (the driver cannot know which assets are referenced until
// emit runs, but emit needs asset metadata) is solved with a PLACEHOLDER: when
// the asset input is not yet set, the derivation first tries to read the bytes
// from disk itself (a backstop so standalone builds resolve real urls); if the
// file cannot be read either, it returns a zero-metadata placeholder whose
// `publicUrl` is derived from the asset key alone. The schema parse completes
// against placeholders; the driver then reads the referenced asset files, sets
// the inputs, and re-demands emit. The dependency recorded on the placeholder
// path ensures the asset memo (and every dependent) recomputes when the input
// arrives.
//
// The assetKey identity, the engine input id, and the template-based output
// naming live in `../assets` — the neutral seam shared with schemas, the
// content execution layer, and the driver. The derivation key is
// `{assetKey, template, blur?}` — same bytes can be rendered to different
// filenames (per-schema `outputName`) and produce different blur dimensions; we
// want each (key, template, blur) tuple to memo independently while the engine
// input is still keyed by assetKey alone.

import { assetInput, publicUrlOf } from '../assets'
import { EngineError } from '../engine'
import { join } from '../util/path'

import type { FileSystem, ImageProcessor } from '../../runtime'
import type { AssetKey, AssetResult } from '../assets'
import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'

/** Default blur width used when no explicit width is requested. */
const BLUR_WIDTH = 8

const placeholder = (key: AssetKey, config: ResolvedConfig): AssetResult => ({
  publicUrl: publicUrlOf(key.assetKey, key.template, undefined, config.output.base),
  resolved: false,
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

/** A resolved non-image asset: real public url, zero image metadata. */
const resolvedFile = (publicUrl: string): AssetResult => ({
  publicUrl,
  resolved: true,
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

/**
 * `asset({assetKey, template, blur})` → resolved public url + image metadata.
 *
 * Reads the INPUT `asset:<assetKey>` (raw bytes). Two outcomes:
 *  - input UNSET → read the file from disk as a backstop; if that fails too,
 *    return a zero-metadata placeholder (the engine dependency is still
 *    recorded, so setting the input later invalidates this memo + dependents);
 *  - input SET → compute the real (content-hashed) public url and probe via the
 *    image processor when metadata was requested.
 *
 * The try/catch is INSIDE compute on purpose: `context.input()` records the
 * dependency before throwing, so catching the `missing-input` error preserves
 * the tracked dep while letting compute return a fallback value.
 */
export const createAssetDerivation = (config: ResolvedConfig, image: ImageProcessor, fs: FileSystem): Derivation<AssetKey, AssetResult> => ({
  name: 'asset',
  key: k => {
    const blur = k.blur === undefined ? '' : `${k.blur.width ?? ''}|${k.blur.height ?? ''}|${k.blur.quality ?? ''}`
    // U+0000 written as an escape (not a literal NUL byte) so this source
    // file stays plain text to git/file/diff tooling. The delimiter just
    // needs to be a character that cannot appear in template / blur /
    // assetKey values.
    return `${k.metadata === true ? 'image' : 'file'}\u0000${k.template}\u0000${blur}\u0000${k.assetKey}`
  },
  async compute(context, key) {
    let bytes: Uint8Array
    try {
      bytes = context.input<Uint8Array>(assetInput(key.assetKey))
    } catch (err) {
      if (err instanceof EngineError && err.code === 'missing-input') {
        try {
          bytes = await fs.read(join(config.root, key.assetKey))
        } catch {
          return placeholder(key, config)
        }
      } else {
        throw err
      }
    }

    // Hash the bytes once — both the file and image branches reuse this url.
    const publicUrl = publicUrlOf(key.assetKey, key.template, bytes, config.output.base)
    if (key.metadata !== true) return resolvedFile(publicUrl)
    // Probe + blur can fail on corrupt / unsupported images (e.g. some SVGs
    // without intrinsic size, truncated downloads). Degrade to zero metadata
    // rather than crashing the build — the public url is still valid (it's
    // derived from the bytes hash), only the image dimensions/blur are absent.
    // A future `--strict` images mode could surface these as diagnostics.
    try {
      const probed = await image.probe(bytes)
      const { width, height } = probed
      if (width > 0 && height > 0) {
        const requestedWidth = key.blur?.width ?? BLUR_WIDTH
        const blurHeight = key.blur?.height ?? Math.max(1, Math.round((requestedWidth * height) / width))
        const blurDataURL = await image.blurDataURL(bytes, { width, height }, { width: requestedWidth, height: blurHeight, quality: key.blur?.quality })
        return { publicUrl, resolved: true, width, height, format: probed.format, blurDataURL, blurWidth: requestedWidth, blurHeight }
      }
      return { publicUrl, resolved: true, width, height, format: probed.format, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    } catch {
      return { publicUrl, resolved: true, width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    }
  }
})
