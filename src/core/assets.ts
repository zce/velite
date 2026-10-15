// Shared asset identity + naming contract — the neutral seam between schemas
// (`s.file` / `s.image`), the content execution layer, the driver, and the
// asset derivation in `pipeline/asset.ts`.
//
// assetKey mapping: the assetKey is the content-root-relative POSIX source
// path of the asset (i.e. relative to the configured content `root` — not the
// project root). The engine input id is `'asset:' + assetKey`. `s.file` /
// `s.image` resolve a content-relative `src` to an absolute source path, then
// derive `assetKey = relative(root, absSourcePath)`; the driver reads the
// effect's absolute `assetPath`, applies the same `relative(root, ...)`, and
// sets the matching input. Both sides reach through this module so the
// identity can never drift between who demands and who feeds.

import { hash } from './util/hash'
import { extname, relative } from './util/path'

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

/**
 * Render an asset's output name from a template.
 *
 * Supports `[name]`, `[hash]`, `[hash:N]`, `[ext]`. `[hash]` requires `bytes`
 * (returns the placeholder `name.ext`-style rendering when bytes are unset, so
 * pass 1 of the two-pass driver works without breaking). The template may
 * include `/` separators for sub-directories — `runtime.fs.write` handles the
 * recursive mkdir on the write side.
 */
const renderAssetName = (assetKey: string, template: string, bytes?: Uint8Array): string => {
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

/** The public url for an asset: `base` (from `output.base`) + rendered name. */
export const publicUrlOf = (assetKey: string, template: string, bytes: Uint8Array | undefined, base: string): string =>
  base + renderAssetName(assetKey, template, bytes)
