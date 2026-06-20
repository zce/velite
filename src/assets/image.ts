import { createHash } from 'node:crypto'

/** Image object with metadata & blur placeholder. */
export interface ImageData {
  /** public url of the image */
  src: string
  /** image width */
  width: number
  /** image height */
  height: number
  /** blur placeholder data url */
  blurDataURL: string
  /** blur image width */
  blurWidth: number
  /** blur image height */
  blurHeight: number
}

/** Blur placeholder options. */
export interface ImageBlurOptions {
  /** blur image width. @default 8 */
  width?: number
  /** blur image height. @default derived from aspect ratio */
  height?: number
  /** webp quality of the blur image (1-100). @default 1 */
  quality?: number
}

/** Image schema options. */
export interface ImageOptions {
  /**
   * Root path for absolute paths. When provided, an absolute value is read
   * directly from this root instead of being treated as a content-relative asset.
   * @default undefined
   */
  absoluteRoot?: string
  /** Blur placeholder options. @default undefined */
  blur?: ImageBlurOptions
}

/** Read image metadata and generate a blur placeholder. */
export const getImageMetadata = async (buffer: Buffer, blurOptions: ImageBlurOptions = {}): Promise<Omit<ImageData, 'src'> | undefined> => {
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

/** Hash raw bytes (md5) for asset content fingerprinting. */
export const hashBytes = (buffer: Buffer | Uint8Array): string => createHash('md5').update(buffer).digest('hex')
