import { resolve } from 'node:path'

import { logger as defaultLogger } from '../runtime/logger'
import { matchPatterns } from '../utils/patterns'

import type { Logger } from '../runtime/logger'
import type { Engine } from './engine'
import type { BuildOptions } from './types'

export interface Watcher {
  close(): Promise<void>
}

export interface WatchController {
  start(engine: Engine, options: BuildOptions): Promise<Watcher>
}

export interface WatcherOptions {
  logger?: Logger
}

interface ChokidarLike {
  on(event: string, handler: (event: string, filename?: string) => void): ChokidarLike
  close(): Promise<void> | void
}

const loadChokidar = async () => {
  const mod = await import('chokidar')
  return mod.watch
}

/**
 * Create a watch controller bound to a build engine.
 *
 * The controller:
 *   - watches `engine.config.root` plus `configImports`,
 *   - on a content change matching a collection pattern, calls
 *     `engine.rebuild()`,
 *   - on a config dependency change, closes the watcher, calls
 *     `engine.build({ ...options, clean: false })`, and re-arms a new watcher
 *     against the freshly resolved config.
 *
 * The controller never holds a `BuildSession`; sessions are created and
 * discarded inside the engine on every (re)build.
 */
export const createWatcher = ({ logger = defaultLogger }: WatcherOptions = {}): WatchController => {
  const armWatcher = async (engine: Engine, options: BuildOptions): Promise<Watcher> => {
    const config = engine.config
    if (config == null) {
      throw new Error('engine.config missing — call engine.build() before starting the watcher')
    }

    const watch = await loadChokidar()
    const { root, collections, configImports } = config
    const patterns = Object.values(collections).flatMap(({ pattern }) => pattern)

    logger.info(`watching for changes in '${root}'`)

    const watcher = watch(['.', ...configImports], {
      cwd: root,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
    }) as unknown as ChokidarLike

    // `current` is replaced after a config reload so that the public Watcher
    // returned by `start()` always closes the most recently armed watcher.
    const handle: { active: boolean; replacement?: Watcher } = { active: true }

    const onEvent = async (event: string, filename?: string): Promise<void> => {
      if (!handle.active) return
      if (event === 'addDir' || event === 'unlinkDir') return
      if (filename == null || typeof filename !== 'string') return

      try {
        const fullpath = resolve(root, filename)

        if (configImports.includes(fullpath)) {
          logger.info('velite config changed, restarting...')
          handle.active = false
          await watcher.close()
          // Config-reload path: clean: false so the engine does not nuke the
          // existing output. writeEntry still runs because engine.build() does.
          await engine.build({ ...options, clean: false })
          handle.replacement = await armWatcher(engine, options)
          return
        }

        if (!matchPatterns(filename, patterns)) return

        const begin = performance.now()
        logger.info(`changed: '${fullpath}', rebuilding...`)
        await engine.rebuild()
        logger.info('rebuild finished', begin)
      } catch (err) {
        logger.warn(err)
      }
    }

    watcher.on('all', onEvent)

    return {
      async close() {
        if (handle.active) {
          handle.active = false
          await watcher.close()
        }
        if (handle.replacement != null) {
          await handle.replacement.close()
        }
      }
    }
  }

  return {
    start(engine, options) {
      return armWatcher(engine, options)
    }
  }
}
