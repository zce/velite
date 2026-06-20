/** Image object with metadata & blur image. */
export interface VeliteImage {
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

/** Read image metadata and generate a blur placeholder. */
export const getImageMetadata = async (buffer: Buffer, blurOptions: BlurOptions = {}): Promise<Omit<VeliteImage, 'src'> | undefined> => {
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
