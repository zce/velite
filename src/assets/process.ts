import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

import { createAssetProcessKey } from './cache'
import { getImageMetadata, hashBytes } from './image'

import type { AssetProcessingCache, CachedAssetProcessResult } from './cache'
import type { ImageBlurOptions, ImageData } from './image'
import type { AssetStore } from './store'

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const ABS_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const ABS_PATH_RE = /^(\/[^/\\]|[a-zA-Z]:\\)/

/** Validate if a url is a relative path (a candidate content asset reference). */
export const isRelativePath = (url: string): boolean => {
  if (url.startsWith('#') || url.startsWith('?') || url.startsWith('//')) return false
  if (ABS_URL_RE.test(url)) return false
  if (ABS_PATH_RE.test(url)) return false
  return true
}

/** Result of processing a single asset reference. */
export interface ProcessAssetResult {
  readonly sourcePath: string
  readonly outputName: string
  readonly publicUrl: string
  readonly fingerprint: string
  readonly image?: Omit<ImageData, 'src'>
}

export interface ProcessAssetInput {
  /** The referenced asset path or url. */
  input: string
  /** Absolute path of the content file that referenced the asset (the owner). */
  from: string
  /** Asset filename template, e.g. `[name]-[hash:8].[ext]`. */
  filename: string
  /** Public base url prefixed to rendered asset names. */
  baseUrl: string
  /** Session asset store collecting emit records. */
  assets: AssetStore
  /** Engine-scoped processing cache deduping work across owners. */
  cache?: AssetProcessingCache
  /** Whether the asset is an image (metadata + blur extracted). */
  isImage?: boolean
  /** Blur placeholder options for image assets. */
  blur?: ImageBlurOptions
}

const renderName = (template: string, path: string, fingerprint: string): string =>
  template.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
    const key = groups[0] as string
    const length = groups[2] == null ? undefined : parseInt(groups[2] as string)
    const ext = extname(path)
    switch (key) {
      case 'name':
        return basename(path, ext).slice(0, length)
      case 'hash':
        return fingerprint.slice(0, length)
      case 'ext':
        return ext.slice(1, length == null ? undefined : length + 1)
    }
    return substring
  })

const readAndProcess = async (path: string, input: ProcessAssetInput): Promise<ProcessAssetResult> => {
  const buffer = await readFile(path)
  const fingerprint = hashBytes(buffer)
  const outputName = renderName(input.filename, path, fingerprint)
  const publicUrl = input.baseUrl + outputName
  const result: ProcessAssetResult = { sourcePath: path, outputName, publicUrl, fingerprint }
  if (input.isImage === true) {
    const metadata = await getImageMetadata(buffer, input.blur)
    if (metadata == null) throw new Error(`invalid image: ${input.from}`)
    return { ...result, image: metadata }
  }
  return result
}

/**
 * Process a referenced asset of a content file.
 *
 * Records the asset on the supplied `AssetStore` (session-scoped) and returns
 * its public url plus optional image metadata. When `cache` is provided, the
 * heavy work (read + hash + sharp) is memoized across owners; the owner content
 * path is still registered on every call so emit logic sees each reference.
 */
export const processAsset = async (input: ProcessAssetInput): Promise<ProcessAssetResult> => {
  const queryIdx = input.input.indexOf('?')
  const hashIdx = input.input.indexOf('#')
  const index = Math.min(queryIdx >= 0 ? queryIdx : Infinity, hashIdx >= 0 ? hashIdx : Infinity)
  const suffix = input.input.slice(index)
  const path = resolve(input.from, '..', input.input.slice(0, index))

  if (input.cache != null) {
    input.cache.recordOwner(path, input.from)
    const key = createAssetProcessKey({
      sourcePath: path,
      filename: input.filename,
      baseUrl: input.baseUrl,
      suffix,
      isImage: input.isImage === true,
      blurOptions: input.blur
    })
    const cached = await input.cache.getOrCreate(key, path, async (): Promise<CachedAssetProcessResult> => {
      const result = await readAndProcess(path, input)
      return { sourcePath: result.sourcePath, outputName: result.outputName, fingerprint: result.fingerprint, publicUrl: result.publicUrl, image: result.image }
    })
    input.assets.add({ sourcePath: cached.sourcePath, outputName: cached.outputName, fingerprint: cached.fingerprint })
    return { sourcePath: cached.sourcePath, outputName: cached.outputName, publicUrl: cached.publicUrl, fingerprint: cached.fingerprint, image: cached.image }
  }

  const result = await readAndProcess(path, input)
  input.assets.add({ sourcePath: result.sourcePath, outputName: result.outputName, fingerprint: result.fingerprint })
  return result
}
