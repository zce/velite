import { createHash } from 'node:crypto'
import { copyFile, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'

import type { Output } from '../types'

/**
 * Image object with metadata & blur image
 */
interface Image {
  src: string
  height: number
  width: number
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}

let outputConfig: Output | undefined

/**
 * set output config, required to call before output
 * @param output output config
 */
export const initOutputConfig = (output: Output): void => {
  outputConfig = output
}

const outputCache = {
  files: new Set<string>(),
  images: new Map<string, Image>()
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
    throw new Error('output config not initialized')
  }

  // ignore absolute url
  if (/^(https?:\/\/|data:|mailto:|\/)/.test(ref)) return ref
  // ignore empty or markdown file (blacklist)
  if (['', '.md'].includes(extname(ref))) return ref
  const from = resolve(fromPath, '..', ref)
  const source = await readFile(from)
  const name = md5(source) + extname(ref)
  const src = `${outputConfig.publicPath}/${name}`
  if (isImage == null) {
    if (outputCache.files.has(name)) return src
    await copyFile(from, join(outputConfig.static, name))
    outputCache.files.add(name) // not await works, but await not works, becareful if copy failed
    return src
  }
  if (outputCache.images.has(name)) return outputCache.images.get(name) as Image
  const img = await getImageMetadata(source)
  if (img == null) return ref
  const image = { src, ...img }
  await copyFile(from, join(outputConfig.static, name))
  outputCache.images.set(name, image)
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
