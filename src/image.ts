import glob from 'fast-glob'
import ora from 'ora'
import sharp from 'sharp'

type Options = {
  root?: string
  pattern?: string
  sizes?: number[]
  quality?: number
}

export const image = async ({ root, pattern = '**/*.{jpg,jpeg,png,gif}', sizes = [640, 720, 1280, 1600], quality = 80 }: Options) => {
  const spinner = ora('optimizing images').start()
  const files = await glob(pattern, { cwd: root, absolute: true })
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
