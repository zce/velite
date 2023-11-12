import glob from 'fast-glob'
import ora from 'ora'
import sharp from 'sharp'

import { resolveConfig } from './config'

type Options = {
  dir?: string
  config?: string
  pattern?: string
  sizes?: number[]
  quality?: number
  verbose?: boolean
}

export const image = async (options: Options) => {
  const spinner = ora('optimizing images').start()

  const config = await resolveConfig({ filename: options.config, verbose: options.verbose })

  const pattern = options.pattern ?? '**/*.{jpg,jpeg,png,gif,webp}'
  const cwd = options.dir ?? config.output?.static
  const sizes = options.sizes ?? config.image?.sizes ?? [640, 720, 1280, 1600]
  const quality = options.quality ?? config.image?.quality ?? 80

  const files = await glob(pattern, { cwd, absolute: true })

  const tasks = files.map(async file => {
    const image = sharp(file)
    const { width, height } = await image.metadata()
    if (width == null || height == null) return
    const aspectRatio = width / height
    await Promise.all(
      sizes.map(size =>
        image
          .resize({
            width: size,
            height: Math.round(size / aspectRatio),
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality })
          .toFile(file.replace(/\.[a-z]+$/i, `.${size}.webp`))
      )
    )
  })
  try {
    await Promise.all(tasks)
    spinner.succeed(`optimized ${files.length} images`)
  } catch (err: any) {
    spinner.fail(`failed to optimize images: ${err.message}`)
    console.log(err)
  }
}
