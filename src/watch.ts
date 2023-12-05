import { join } from 'node:path'

import { init } from './context'
import { logger } from './logger'
import { resolve } from './resolve'

import type { Context } from './context'

/**
 * watch files and rebuild on changes
 * @param ctx build context
 */
export const watch = async (ctx: Context) => {
  const { watch } = await import('chokidar')
  logger.info(`watching for changes in '${ctx.root}'`)

  const files = Object.values(ctx.collections).map(schema => schema.pattern)
  files.push(ctx.configPath) // watch config file changes

  watch(files, {
    cwd: ctx.root,
    ignored: /(^|[\/\\])[\._]./, // ignore dot & underscore files
    ignoreInitial: true, // ignore initial scan
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  }).on('all', async (_, filename) => {
    if (filename == null) return
    const begin = performance.now()
    filename = join(ctx.root, filename)
    try {
      if (filename === ctx.configPath) {
        // reload config if config file changed
        logger.info(`config changed '${filename}', reloading...`)
        await resolve(await init(ctx.configPath, false))
        // TODO: need rewatch files if config file changed
        // const newConfig = await init(config.configPath, config.output.clean)
        // await resolve(newConfig)
        // const newFiles = Object.values(config.collections).map(schema => schema.pattern)
        // newFiles.push(config.configPath) // watch config file changes
        // watcher.unwatch(files).add(newFiles)
      } else {
        logger.info(`file changed '${filename}', rebuilding...`)
        await resolve(ctx, filename)
      }
    } catch (err) {
      logger.warn(err)
    }

    logger.info(`rebuild finished`, begin)
  })
}
