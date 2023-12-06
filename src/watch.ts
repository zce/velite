import { join } from 'node:path'

import { context, init } from './context'
import { logger } from './logger'
import { resolve } from './resolve'

/**
 * watch files and rebuild on changes
 */
export const watch = async () => {
  const { configPath, root, collections } = context
  const { watch } = await import('chokidar')
  logger.info(`watching for changes in '${root}'`)

  const files = Object.values(collections).map(({ pattern }) => pattern)
  files.push(configPath) // watch config file changes

  const watcher = watch(files, {
    cwd: root,
    ignored: /(^|[\/\\])[\._]./, // ignore dot & underscore files
    ignoreInitial: true, // ignore initial scan
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  }).on('all', async (event, filename) => {
    if (event === 'addDir' || event === 'unlinkDir') return // ignore dir changes
    if (filename == null) return
    const begin = performance.now()
    filename = join(root, filename)
    try {
      if (filename === configPath) {
        // reload config if config file changed
        logger.info(`config changed '${filename}', reloading...`)
        await init(configPath, false) // reinit context
        await resolve()
        // TODO: need rewatch files if config file changed
        watcher.unwatch('**').add(
          Object.values(context.collections)
            .map(({ pattern }) => pattern)
            .concat(context.configPath)
        )
      } else {
        logger.info(`file changed '${filename}', rebuilding...`)
        await resolve(filename)
      }
    } catch (err) {
      logger.warn(err)
    }

    logger.info(`rebuild finished`, begin)
  })
}
