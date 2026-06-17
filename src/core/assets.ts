import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { visit } from 'unist-util-visit'

import { defineStoreKey } from './store'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast, Node } from 'mdast'
import type { VFile } from 'vfile'
import type { Output } from '../types'

/** Asset record collected during a build session. */
export interface AssetRecord {
  /** Absolute source path of the original asset. */
  sourcePath: string
  /** Rendered output filename. Used as the dedup key. */
  outputName: string
  /** Final public URL exposed in parsed content. */
  publicUrl: string
  /** Content files that caused this asset to be collected. */
  ownerFiles: Set<string>
}

/**
 * Session-owned store for asset collection.
 *
 * `add()` is idempotent for the same `outputName`. The same `outputName` with
 * a different `sourcePath` is accepted as long as the caller asserts the
 * content is identical (typically by passing a content `fingerprint`, e.g.
 * an md5 of the source bytes). When the caller provides fingerprints and they
 * disagree, `add()` throws to surface a real hash collision or an unsafe
 * filename template.
 */
export interface AssetStore {
  add(input: { sourcePath: string; outputName: string; publicUrl: string; ownerFile: string; fingerprint?: string }): AssetRecord
  list(): AssetRecord[]
  byOwner(file: string): AssetRecord[]
}

interface InternalRecord extends AssetRecord {
  fingerprint?: string
}

/**
 * Create a new asset store backed by an in-memory map.
 */
export const createAssetStore = (): AssetStore => {
  const records = new Map<string, InternalRecord>()

  return {
    add({ sourcePath, outputName, publicUrl, ownerFile, fingerprint }) {
      const existing = records.get(outputName)
      if (existing != null) {
        if (existing.sourcePath !== sourcePath) {
          // Different source path is fine when the caller proves the content
          // is identical (same md5 / same hash). Without a fingerprint, we
          // assume the template embeds enough entropy (typically `[hash]`).
          if (fingerprint != null && existing.fingerprint != null && fingerprint !== existing.fingerprint) {
            throw new Error(
              `Asset name collision for '${outputName}': '${existing.sourcePath}' and '${sourcePath}' have different content. ` +
                'Adjust the output filename template (for example include [hash:8]).'
            )
          }
          if (fingerprint != null && existing.fingerprint == null) {
            existing.fingerprint = fingerprint
          }
        }
        existing.ownerFiles.add(ownerFile)
        return existing
      }
      const record: InternalRecord = {
        sourcePath,
        outputName,
        publicUrl,
        ownerFiles: new Set([ownerFile]),
        fingerprint
      }
      records.set(outputName, record)
      return record
    },
    list() {
      return Array.from(records.values())
    },
    byOwner(file) {
      const out: AssetRecord[] = []
      for (const r of records.values()) {
        if (r.ownerFiles.has(file)) out.push(r)
      }
      return out
    }
  }
}

/** Store key used by asset-producing schemas. */
export const assetStoreKey = defineStoreKey('velite.assets', createAssetStore)

/** Image object with metadata & blur image. */
export interface Image {
  /** public url of the image */
  src: string
  /** image width */
  width: number
  /** image height */
  height: number
  /** blurDataURL of the image */
  blurDataURL: string
  /** blur image width */
  blurWidth: number
  /** blur image height */
  blurHeight: number
}

/** Blur placeholder options. */
export interface BlurOptions {
  /**
   * blur image width
   * @default 8
   */
  width?: number
  /**
   * blur image height
   * @default derived from aspect ratio
   */
  height?: number
  /**
   * webp quality of the blur image (1-100)
   * @default 1
   */
  quality?: number
}

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

/** Read image metadata and generate a blur placeholder. */
export const getImageMetadata = async (buffer: Buffer, blurOptions: BlurOptions = {}): Promise<Omit<Image, 'src'> | undefined> => {
  const { default: sharp } = await import('sharp')
  const img = sharp(buffer)
  const { width, height } = await img.metadata()
  if (width == null || height == null) return
  const aspectRatio = width / height
  const blurWidth = blurOptions.width ?? 8
  const blurHeight = blurOptions.height ?? Math.max(1, Math.round(blurWidth / aspectRatio))
  const quality = blurOptions.quality ?? 1
  const blurImage = await img.resize(blurWidth, blurHeight).webp({ quality }).toBuffer()
  const blurDataURL = `data:image/webp;base64,${blurImage.toString('base64')}`
  return { height, width, blurDataURL, blurWidth, blurHeight }
}

/**
 * Process a referenced asset of a file.
 *
 * Records the asset on the supplied `AssetStore` (session-scoped) and returns
 * either the public URL (for `s.file()`) or an `Image` object (for `s.image()`).
 */
export const processAsset = async <T extends true | undefined = undefined>(
  input: string,
  from: string,
  filename: string,
  baseUrl: string,
  assets: AssetStore,
  isImage?: T,
  blurOptions?: BlurOptions
): Promise<T extends true ? Image : string> => {
  const queryIdx = input.indexOf('?')
  const hashIdx = input.indexOf('#')
  const index = Math.min(queryIdx >= 0 ? queryIdx : Infinity, hashIdx >= 0 ? hashIdx : Infinity)
  const suffix = input.slice(index)
  const path = resolve(from, '..', input.slice(0, index))
  const ext = extname(path)

  const buffer = await readFile(path)
  const fingerprint = createHash('md5').update(buffer).digest('hex')

  const name = filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
    const key = groups[0]
    const length = groups[2] == null ? undefined : parseInt(groups[2])
    switch (key) {
      case 'name':
        return basename(path, ext).slice(0, length)
      case 'hash':
        return fingerprint.slice(0, length)
      case 'ext':
        return ext.slice(1, length)
    }
    return substring
  })

  const src = baseUrl + name + suffix
  assets.add({ sourcePath: path, outputName: name, publicUrl: src, ownerFile: from, fingerprint })

  if (isImage !== true) return src as T extends true ? Image : string

  const metadata = await getImageMetadata(buffer, blurOptions)
  if (metadata == null) throw new Error(`invalid image: ${from}`)
  return { src, ...metadata } as T extends true ? Image : string
}

export type CopyLinkedFilesOptions = Omit<Output, 'data' | 'clean'> & { assets: AssetStore }

/** rehype plugin to collect linked files and rewrite their urls. */
export const rehypeCopyLinkedFiles = (options: CopyLinkedFilesOptions) => async (tree: Hast, file: VFile) => {
  const links = new Map<string, Element[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isRelativePath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, elements]) => {
      const publicUrl = await processAsset(url, file.path, options.name, options.base, options.assets)
      if (publicUrl == null || publicUrl === url) return
      elements.forEach(node => {
        linkedPropertyNames.forEach(name => {
          if (name in node.properties) {
            node.properties[name] = publicUrl
          }
        })
      })
    })
  )
}

/** remark plugin to collect linked files and rewrite their urls. */
export const remarkCopyLinkedFiles = (options: CopyLinkedFilesOptions) => async (tree: Mdast, file: VFile) => {
  const links = new Map<string, Node[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, ['link', 'image', 'definition'], (node: any) => {
    if (isRelativePath(node.url)) {
      const nodes = links.get(node.url) ?? []
      nodes.push(node)
      links.set(node.url, nodes)
    }
  })
  visit(tree, 'mdxJsxFlowElement', node => {
    node.attributes.forEach((attr: any) => {
      if (linkedPropertyNames.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) {
        const nodes = links.get(attr.value) ?? []
        nodes.push(node)
        links.set(attr.value, nodes)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, nodes]) => {
      const publicUrl = await processAsset(url, file.path, options.name, options.base, options.assets)
      if (publicUrl == null || publicUrl === url) return
      nodes.forEach((node: any) => {
        if (node.url === url) {
          node.url = publicUrl
          return
        }
        node.attributes.forEach((attr: any) => {
          linkedPropertyNames.forEach(name => {
            if (attr.name === name && attr.value === url) {
              attr.value = publicUrl
            }
          })
        })
      })
    })
  )
}
