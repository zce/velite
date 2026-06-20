import { resolve } from 'node:path'

import { logger as defaultLogger } from '../runtime/logger'
import { matchPatterns } from '../utils/patterns'

import type { Collections } from '../collections'
import type { Logger } from '../runtime/logger'
import type { Engine, RebuildEvent } from './engine'
import type { BuildOptions } from './types'

export interface Watcher {
  close(): Promise<void>
}

export interface WatchController {
  start<T extends Collections>(engine: Engine<T>, options: BuildOptions): Promise<Watcher>
}

export interface WatcherOptions {
  logger?: Logger
}

/**
 * Create a watch controller bound to a build engine.
 *
 * The controller:
 *   - watches `engine.config.root` plus `configImports`,
 *   - on a content change matching a collection pattern, calls
 *     `engine.rebuild()`,
 *   - on a config dependency change, closes the watcher, calls
 *     `engine.build(options)`, and re-arms a new watcher
 *     against the freshly resolved config.
 *
 * The controller never holds a `BuildSession`; sessions are created and
 * discarded inside the engine on every (re)build.
 */
export const createWatcher = ({ logger = defaultLogger }: WatcherOptions = {}): WatchController => {
  const armWatcher = async <T extends Collections>(engine: Engine<T>, options: BuildOptions): Promise<Watcher> => {
    const config = engine.config
    if (config == null) {
      throw new Error('engine.config missing — call engine.build() before starting the watcher')
    }

    const { watch } = await import('chokidar')
    const { root, collections, configImports } = config
    const patterns = Object.values(collections).flatMap(({ pattern }) => pattern)

    logger.info(`watching for changes in '${root}'`)

    const watcher = watch(['.', ...configImports], {
      cwd: root,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
    })

    // `current` is replaced after a config reload so that the public Watcher
    // returned by `start()` always closes the most recently armed watcher.
    const handle: { active: boolean; replacement?: Watcher } = { active: true }

    watcher.on('all', async (event, filename): Promise<void> => {
      if (!handle.active) return
      if (event === 'addDir' || event === 'unlinkDir') return
      if (filename == null || typeof filename !== 'string') return

      try {
        const fullpath = resolve(root, filename)

        if (configImports.includes(fullpath)) {
          logger.info('velite config changed, restarting...')
          handle.active = false
          await watcher.close()
          await engine.build(options)
          handle.replacement = await armWatcher(engine, options)
          return
        }

        if (matchPatterns(filename, patterns)) {
          const rebuildEvent: RebuildEvent = event === 'add' || event === 'unlink' ? event : 'change'
          const begin = performance.now()
          logger.info(`changed: '${fullpath}', rebuilding...`)
          await engine.rebuild({ event: rebuildEvent, paths: [fullpath] })
          logger.info('rebuild finished', begin)
          return
        }

        if (engine.hasAssetSource(fullpath)) {
          const owners = engine.invalidateAssetSource(fullpath)
          if (owners.length === 0) return
          const begin = performance.now()
          logger.info(`asset changed: '${fullpath}', rebuilding ${owners.length} owner(s)...`)
          await engine.rebuild({ event: 'change', paths: owners })
          logger.info('rebuild finished', begin)
          return
        }
      } catch (err) {
        logger.warn(err)
      }
    })

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
