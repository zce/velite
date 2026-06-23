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
// content-root-relative POSIX source path of the asset (i.e. relative to
// `config.root`, the configured content root — not the project root). The
// engine input id is `'asset:' + assetKey`. `s.file` / `s.image` resolve a
// content-relative `src` to an absolute source path, then derive
// `assetKey = relative(config.root, absSourcePath)` and demand this derivation.
// The driver reads the effect's absolute `assetPath`, applies the same
// `relative(config.root, ...)` to get the assetKey, and sets the matching input.
//
// The derivation key is `{assetKey, template, blur?}` — same bytes can be
// rendered to different filenames (per-schema `outputName`) and produce
// different blur dimensions; we want each (key, template, blur) tuple to memo
// independently while the engine input is still keyed by assetKey alone.

import { EngineError } from '../engine'
import { hash } from '../util/hash'
import { extname, join, relative } from '../util/path'

import type { FileSystem, ImageProcessor } from '../../runtime'
import type { ResolvedConfig } from '../config'
import type { Derivation } from '../engine'

/** Result of resolving an asset: public url plus image metadata (zeros when unknown). */
export interface AssetResult {
  /** Public url of the asset (base + content-hashed name once bytes are known). */
  publicUrl: string
  /** Whether the result was derived from real bytes instead of a placeholder. */
  resolved: boolean
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

/** Blur placeholder options. */
export interface BlurOptions {
  /** Blur image width. @default 8 */
  width?: number
  /** Blur image height. @default derived from aspect ratio */
  height?: number
  /** WebP quality of the blur image (1-100). @default 1 */
  quality?: number
}

/**
 * Key for the asset derivation. `assetKey` keys the underlying bytes input;
 * `template` lets the same bytes be rendered to a different filename; `blur`
 * lets schemas request different blur dimensions/quality without colliding.
 */
export interface AssetKey {
  assetKey: string
  template: string
  blur?: BlurOptions
  metadata?: boolean
}

/** Engine input id holding the raw bytes of the asset identified by `assetKey`. */
export const assetInput = (assetKey: string): string => `asset:${assetKey}`

/**
 * The assetKey for an absolute source path: the content-root-relative POSIX
 * path (relative to `root`, the configured content root — not the project
 * root). This is the stable identity shared by the schema (which demands the
 * derivation) and the driver (which sets the input). Takes the root explicitly
 * so callers with only `project.root` (e.g. schemas) need no `ResolvedConfig`.
 */
export const assetKeyOf = (absSourcePath: string, root: string): string => relative(root, absSourcePath)

/** Default blur width used when no explicit width is requested. */
const BLUR_WIDTH = 8

/**
 * Render an asset's output name from a template.
 *
 * Supports `[name]`, `[hash]`, `[hash:N]`, `[ext]`. `[hash]` requires `bytes`
 * (returns the placeholder `name.ext`-style rendering when bytes are unset, so
 * pass 1 of the two-pass driver works without breaking). The template may
 * include `/` separators for sub-directories — `runtime.fs.write` handles the
 * recursive mkdir on the write side.
 */
export const renderAssetName = (assetKey: string, template: string, bytes?: Uint8Array): string => {
  const base = assetKey.slice(assetKey.lastIndexOf('/') + 1)
  const ext = extname(assetKey)
  const stem = ext.length > 0 ? base.slice(0, -ext.length) : base
  const digest = bytes === undefined ? '' : hash(bytes)
  return template.replace(/\[(name|hash|ext)(?::(\d+))?\]/g, (substring, key, lenStr) => {
    const length = lenStr === undefined ? undefined : parseInt(lenStr, 10)
    switch (key) {
      case 'name':
        return length === undefined ? stem : stem.slice(0, length)
      case 'hash':
        if (digest === '') return '' // placeholder pass — no hash yet
        return length === undefined ? digest : digest.slice(0, length)
      case 'ext':
        return length === undefined ? ext.slice(1) : ext.slice(1, length + 1)
    }
    return substring
  })
}

/** The public url for an asset: base + rendered name. */
export const publicUrlOf = (assetKey: string, template: string, bytes: Uint8Array | undefined, config: ResolvedConfig): string =>
  config.output.base + renderAssetName(assetKey, template, bytes)

const placeholder = (key: AssetKey, config: ResolvedConfig): AssetResult => ({
  publicUrl: publicUrlOf(key.assetKey, key.template, undefined, config),
  resolved: false,
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
 *  - input UNSET → returns a zero-metadata placeholder (the dependency is still
 *    recorded, so setting the input later invalidates this memo + dependents);
 *  - input SET → compute the real (content-hashed) public url and probe via the
 *    image processor.
 *
 * The try/catch is INSIDE compute on purpose: `context.input()` records the
 * dependency before throwing, so catching the `missing-input` error preserves
 * the tracked dep while letting compute return a placeholder value.
 *
 * Takes only the `ImageProcessor` it needs (not the whole Runtime): asset
 * resolution depends on image processing and nothing else, so the dependency
 * is spelled out at the factory edge.
 */
const resolvedFile = (key: AssetKey, config: ResolvedConfig, bytes: Uint8Array): AssetResult => ({
  publicUrl: publicUrlOf(key.assetKey, key.template, bytes, config),
  resolved: true,
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

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

    const publicUrl = publicUrlOf(key.assetKey, key.template, bytes, config)
    if (key.metadata !== true) return resolvedFile(key, config, bytes)
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
