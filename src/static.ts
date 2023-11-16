import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import sharp from 'sharp'

import { cache, getOutputConfig } from './context'

/**
 * Image object with metadata & blur image
 */
export interface Image {
  src: string
  height: number
  width: number
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const absoluteUrlRegex = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const absolutePathRegex = /^(\/[^/\\]|[a-zA-Z]:\\)/

export const isValidatedStaticPath = (url: string): boolean => {
  const output = getOutputConfig()
  if (url.startsWith('#')) return false // ignore hash anchor
  if (url.startsWith('?')) return false // ignore query
  if (url.startsWith('//')) return false // ignore protocol relative urlet name
  if (absoluteUrlRegex.test(url)) return false // ignore absolute url
  if (absolutePathRegex.test(url)) return false // ignore absolute path
  const ext = url.split('.').pop() as string
  return !output.ignoreFileExtensions.includes(ext) // ignore file extensions
}

/**
 * get md5 hash of data
 * @param data source data
 * @returns md5 hash of data
 */
const md5 = (data: string | Buffer): string => {
  return createHash('md5').update(data).digest('hex').slice(0, 8)
}

/**
 * get public directory
 * @param buffer image buffer
 * @returns image object with blurDataURL
 */
const getImageMetadata = async (buffer: Buffer): Promise<Omit<Image, 'src'> | undefined> => {
  const img = sharp(buffer)
  const { width, height } = await img.metadata()
  if (width == null || height == null) return
  const aspectRatio = width / height
  const blurWidth = 8
  const blurHeight = Math.round(blurWidth / aspectRatio)
  // prettier-ignore
  const blurDataURL = await img.resize(blurWidth, blurHeight).webp({ quality: 1 }).toBuffer().then(b => `data:image/webp;base64,${b.toString('base64')}`)
  return { height, width, blurDataURL, blurWidth, blurHeight }
}

const copy = async (from: string, to: string): Promise<void> => {
  const output = getOutputConfig()
  const filename = join(output.static, to)
  await mkdir(dirname(filename), { recursive: true })
  await copyFile(from, filename)
}

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @param isImage process as image and return image object with blurDataURL
 * @returns reference public url or image object
 */
const outputStatic = async (ref: string, fromPath: string, isImage?: true): Promise<Image | string> => {
  if (!isValidatedStaticPath(ref)) return ref

  const output = getOutputConfig()

  const from = resolve(fromPath, '..', ref)
  const source = await readFile(from)

  const filename = output.filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
    const key = groups[0]
    const length = groups[2] == null ? undefined : parseInt(groups[2])
    switch (key) {
      case 'name':
        return basename(ref, extname(ref)).slice(0, length)
      case 'hash':
        return md5(source).slice(0, length)
      case 'ext':
        return extname(ref).slice(1).slice(0, length)
    }
    return substring
  })

  if (isImage == null) {
    const files = cache.get('files') || new Set<string>()
    if (files.has(filename)) return filename
    files.add(filename) // TODO: not await works, but await not works, becareful if copy failed
    await copy(from, filename)
    cache.set('files', files)
    return filename
  }

  const images = cache.get('images') || new Map<string, Image>()
  if (images.has(filename)) return images.get(filename) as Image
  const img = await getImageMetadata(source)
  if (img == null) return ref
  const image = { src: filename, ...img }
  images.set(filename, image)
  cache.set('images', images)
  await copy(from, filename)
  return image
}

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @returns reference public url
 */
export const outputFile = async <T extends string | undefined>(ref: T, fromPath: string): Promise<T> => {
  if (ref == null) return ref
  return outputStatic(ref, fromPath) as Promise<T>
}

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @returns reference public url or image object
 */
export const outputImage = async <T extends string | undefined>(ref: T, fromPath: string): Promise<Image | T> => {
  if (ref == null) return ref
  return outputStatic(ref, fromPath, true) as Promise<Image | T>
}
