// Asset derivation: the memoized, backdating-friendly bridge from raw asset
// bytes to the public-url + image metadata that schemas (`s.image` / `s.file`)
// consume. This is the core of the two-pass asset model (spec §4/§5/§6).
//
// The chicken-and-egg (the driver cannot know which assets are referenced until
// emit runs, but emit needs asset metadata) is solved with a PLACEHOLDER: when
// the asset input is not yet set, the derivation returns a zero-metadata
// placeholder whose `publicUrl` is derivable from the asset key alone (no bytes
// required). The schema parse completes against placeholders; the driver then
// reads the referenced asset files, sets the inputs, and re-demands emit. The
// dependency recorded on the placeholder path ensures the asset memo (and every
// dependent) recomputes when the input arrives.
//
// assetKey mapping (chosen for M5, see report): the assetKey is the
// project-root-relative POSIX source path of the asset. The engine input id is
// `'asset:' + assetKey`. `s.file` / `s.image` resolve a content-relative `src`
// to an absolute source path, then derive `assetKey = relative(config.root,
// absSourcePath)` and demand this derivation. The driver reads the effect's
// absolute `assetPath`, applies the same `relative(config.root, ...)` to get the
// assetKey, and sets the matching input.

import { EngineError } from '../engine'
import { hash } from '../util/hash'
import { posix } from '../util/path'

import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'
import type { Host } from '../host'

/** Result of resolving an asset: public url plus image metadata (zeros when unknown). */
export interface AssetResult {
  /** Public url of the asset (base + content-hashed name once bytes are known). */
  publicUrl: string
  /** Image width (0 when no bytes / no processor / probe failed). */
  width: number
  /** Image height (0 when no bytes / no processor / probe failed). */
  height: number
  /** Image format, e.g. 'png' (empty when no bytes / no processor / probe failed). */
  format: string
  /** Blur placeholder data url (empty when no bytes / no processor). */
  blurDataURL: string
  /** Blur image width (0 when no bytes / no processor). */
  blurWidth: number
  /** Blur image height (0 when no bytes / no processor). */
  blurHeight: number
}

/** Engine input id holding the raw bytes of the asset identified by `assetKey`. */
export const assetInput = (assetKey: string): string => `asset:${assetKey}`

/**
 * The assetKey for an absolute source path: the project-root-relative POSIX
 * path. This is the stable identity shared by the schema (which demands the
 * derivation) and the driver (which sets the input). Takes the root explicitly
 * so callers with only `project.root` (e.g. schemas) need no `ResolvedConfig`.
 */
export const assetKeyOf = (absSourcePath: string, root: string): string => posix.relative(root, absSourcePath)

/** Default blur width used when generating blur placeholders. */
const BLUR_WIDTH = 8

/**
 * Render the output name for an asset key, optionally content-hashed.
 *
 * Without `bytes` (placeholder path): `name.ext` — always available, no bytes
 * required. With `bytes` (real path): `name-<hash8>.ext` — content-hashed for
 * cache-busting. The hash is the core's pure FNV-1a digest (runtime-agnostic,
 * non-cryptographic); it is only a filename fingerprint, never a security
 * primitive.
 */
export const renderAssetName = (assetKey: string, bytes?: Uint8Array): string => {
  const base = assetKey.slice(assetKey.lastIndexOf('/') + 1)
  const ext = posix.extname(assetKey)
  const stem = ext.length > 0 ? base.slice(0, -ext.length) : base
  if (bytes === undefined) return `${stem}${ext}`
  return `${stem}-${hash(bytes).slice(0, 8)}${ext}`
}

/**
 * The public url for an asset: base + rendered name. Derivable from the key
 * alone (placeholder) or from the key + bytes (content-hashed).
 */
export const publicUrlOf = (assetKey: string, bytes: Uint8Array | undefined, config: ResolvedConfig): string =>
  config.output.base + renderAssetName(assetKey, bytes)

const placeholder = (assetKey: string, config: ResolvedConfig): AssetResult => ({
  publicUrl: publicUrlOf(assetKey, undefined, config),
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

/**
 * `asset(assetKey)` → resolved public url + image metadata for one asset.
 *
 * Reads the INPUT `asset:<assetKey>` (raw bytes). Three outcomes:
 *  - input UNSET → returns a zero-metadata placeholder (the dependency is still
 *    recorded, so setting the input later invalidates this memo + dependents);
 *  - input SET, no `host.image` → no-sharp degradation: real (content-hashed)
 *    public url but zero metadata. No crash, no diagnostic (documented);
 *  - input SET, `host.image` present → probe + blur via the host.
 *
 * The try/catch is INSIDE compute on purpose: `context.input()` records the
 * dependency before throwing, so catching the `missing-input` error preserves
 * the tracked dep while letting compute return a placeholder value.
 */
export const createAssetDerivation = (config: ResolvedConfig, host: Host): Derivation<string, AssetResult> => ({
  name: 'asset',
  async compute(context, assetKey) {
    let bytes: Uint8Array
    try {
      bytes = context.input<Uint8Array>(assetInput(assetKey))
    } catch (err) {
      if (err instanceof EngineError && err.code === 'missing-input') return placeholder(assetKey, config)
      throw err
    }

    const publicUrl = publicUrlOf(assetKey, bytes, config)
    const image = host.image
    if (image === undefined) {
      // No-sharp degradation: real (content-hashed) url, zero metadata.
      return { publicUrl, width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    }

    const probed = await image.probe(bytes)
    const { width, height } = probed
    // Only generate a blur placeholder when the image has real dimensions.
    // Calling blurDataURL on a dimensionless image (e.g. an SVG without
    // intrinsic size) would divide by zero inside the host adapter and yield a
    // non-empty data url inconsistent with the zero blurWidth/blurHeight here.
    if (width > 0 && height > 0) {
      const blurDataURL = await image.blurDataURL(bytes)
      const blurHeight = Math.max(1, Math.round((BLUR_WIDTH * height) / width))
      return { publicUrl, width, height, format: probed.format, blurDataURL, blurWidth: BLUR_WIDTH, blurHeight }
    }
    return { publicUrl, width, height, format: probed.format, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
  }
})
