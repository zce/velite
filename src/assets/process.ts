import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

import { createAssetProcessKey } from './cache'
import { getImageMetadata } from './image'

import type { AssetProcessingCache, CachedAssetProcessResult } from './cache'
import type { BlurOptions, VeliteImage } from './image'
import type { AssetStore } from './store'

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const ABS_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const ABS_PATH_RE = /^(\/[^/\\]|[a-zA-Z]:\\)/

/** Validate if a url is a relative path. */
export const isRelativePath = (url: string): boolean => {
  if (url.startsWith('#')) return false
  if (url.startsWith('?')) return false
  if (url.startsWith('//')) return false
  if (ABS_URL_RE.test(url)) return false
  if (ABS_PATH_RE.test(url)) return false
  return true
}

/**
 * Process a referenced asset of a file.
 *
 * Records the asset on the supplied `AssetStore` (session-scoped) and returns
 * either the public URL (for `s.file()`) or a `VeliteImage` object (for `s.image()`).
 *
 * When `cache` is provided, the heavy work (read + hash + image metadata) is
 * memoized across owners so that a shared asset is only loaded once per build.
 * The owning content path is still registered with the asset store on every
 * call so that downstream emit logic sees each reference.
 */
export const processAsset = async <T extends true | undefined = undefined>(
  input: string,
  from: string,
  filename: string,
  baseUrl: string,
  assets: AssetStore,
  isImage?: T,
  blurOptions?: BlurOptions,
  cache?: AssetProcessingCache
): Promise<T extends true ? VeliteImage : string> => {
  const queryIdx = input.indexOf('?')
  const hashIdx = input.indexOf('#')
  const index = Math.min(queryIdx >= 0 ? queryIdx : Infinity, hashIdx >= 0 ? hashIdx : Infinity)
  const suffix = input.slice(index)
  const path = resolve(from, '..', input.slice(0, index))
  const ext = extname(path)

  const renderName = (fingerprint: string): string =>
    filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
      const key = groups[0]
      const length = groups[2] == null ? undefined : parseInt(groups[2])
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

  if (cache != null) {
    cache.recordOwner(path, from)
    const key = createAssetProcessKey({ sourcePath: path, filename, baseUrl, suffix, isImage: isImage === true, blurOptions })
    let pending = cache.get(key)
    if (pending == null) {
      pending = (async (): Promise<CachedAssetProcessResult> => {
        const buffer = await readFile(path)
        const fingerprint = createHash('md5').update(buffer).digest('hex')
        const outputName = renderName(fingerprint)
        const publicUrl = baseUrl + outputName + suffix
        if (isImage !== true) {
          return { sourcePath: path, outputName, fingerprint, publicUrl }
        }
        const metadata = await getImageMetadata(buffer, blurOptions)
        if (metadata == null) throw new Error(`invalid image: ${from}`)
        return { sourcePath: path, outputName, fingerprint, publicUrl, image: metadata }
      })()
      cache.set(key, pending)
    }
    const result = await pending
    assets.add({ sourcePath: result.sourcePath, outputName: result.outputName, fingerprint: result.fingerprint })
    if (isImage !== true) return result.publicUrl as T extends true ? VeliteImage : string
    if (result.image == null) throw new Error(`invalid image: ${from}`)
    return { src: result.publicUrl, ...result.image } as T extends true ? VeliteImage : string
  }

  const buffer = await readFile(path)
  const fingerprint = createHash('md5').update(buffer).digest('hex')

  const name = renderName(fingerprint)

  const src = baseUrl + name + suffix
  assets.add({ sourcePath: path, outputName: name, fingerprint })

  if (isImage !== true) return src as T extends true ? VeliteImage : string

  const metadata = await getImageMetadata(buffer, blurOptions)
  if (metadata == null) throw new Error(`invalid image: ${from}`)
  return { src, ...metadata } as T extends true ? VeliteImage : string
}
