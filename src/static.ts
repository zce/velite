import { createHash } from 'node:crypto'
import { copyFile, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'
import type { Image } from './types'

let outputConfig: { dir: string; base: string } | undefined

const outputCache = {
  files: new Set<string>(),
  images: new Map<string, Image>()
}

/**
 * set public directory and url prefix
 * @param dir public directory copied to
 * @param base url prefix for public access
 */
export const setPublic = (dir: string, base: string): void => {
  outputConfig = { dir, base }
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

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @param isImage process as image and return image object with blurDataURL
 * @returns reference public url or image object
 */
const outputStatic = async (ref: string, fromPath: string, isImage?: true): Promise<Image | string> => {
  if (outputConfig == null) {
    throw new Error('`setPublic` must be called before `outputStatic`')
  }

  // ignore absolute url
  if (/^(https?:\/\/|data:|mailto:|\/)/.test(ref)) return ref
  // ignore empty or markdown file (blacklist)
  if (['', '.md'].includes(extname(ref))) return ref
  const from = resolve(fromPath, '..', ref)
  const source = await readFile(from)
  const name = md5(source) + extname(ref)
  const src = `${outputConfig.base}/${name}`
  if (isImage == null) {
    if (outputCache.files.has(name)) return src
    await copyFile(from, join(outputConfig.dir, name))
    outputCache.files.add(name) // not await works, but await not works, becareful if copy failed
    return src
  }
  if (outputCache.images.has(name)) return outputCache.images.get(name) as Image
  const img = await getImageMetadata(source)
  if (img == null) return ref
  const image = { src, ...img }
  await copyFile(from, join(outputConfig.dir, name))
  outputCache.images.set(name, image)
  return image
}

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @returns reference public url
 */
export const outputFile = async (ref: string | undefined, fromPath: string): Promise<string | undefined> => {
  if (ref == null) return ref
  return outputStatic(ref, fromPath) as Promise<string>
}

/**
 * output static file reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @returns reference public url or image object
 */
export const outputImage = async (ref: string | undefined, fromPath: string): Promise<Image | string | undefined> => {
  if (ref == null) return ref
  return outputStatic(ref, fromPath, true)
}
