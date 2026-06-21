import { resolve } from 'node:path'

import { matchPatterns } from '../collections/discover'
import { fail, VeliteError } from '../core/errors'
import { logger as defaultLogger } from '../runtime/logger'

import type { BuildResult, Collections } from '../collections'
import type { Diagnostic } from '../core/errors'
import type { Logger } from '../runtime/logger'
import type { BuildOptions, Engine, RebuildEvent } from './engine'

/** A build event observed by the `onBuild` callback. */
export type WatchBuildEvent<TCollections extends Collections = Collections> =
  | { type: 'success'; result: BuildResult<TCollections>; diagnostics: readonly Diagnostic[] }
  | { type: 'failure'; error: VeliteError; diagnostics: readonly Diagnostic[] }

/** Options for `watch()`. */
export interface WatchOptions extends BuildOptions {
  /** Observer callback invoked after each build run (not a pipeline hook). */
  onBuild?: (event: WatchBuildEvent) => void | Promise<void>
}

/** A closeable watch handle. */
export interface Watcher<TCollections extends Collections = Collections> {
  readonly closed: boolean
  close(): Promise<void>
}

export interface WatchController {
  start<T extends Collections>(engine: Engine, options: WatchOptions): Promise<Watcher<T>>
}

export interface WatcherOptions {
  logger?: Logger
}

/**
 * Create a watch controller bound to a build engine.
 *
 * The controller serializes rebuilds: at most one build run executes at a time,
 * and file events arriving during a run coalesce into a single pending rebuild.
 * Content changes matching a collection pattern trigger an incremental rebuild;
 * asset changes outside any pattern invalidate the referencing owners; config
 * dependency changes trigger a safe reload (fresh session). `close()` stops
 * accepting new events and waits for the in-flight run to finish or roll back.
 */
export const createWatcher = ({ logger = defaultLogger }: WatcherOptions = {}): WatchController => {
  const arm = async <T extends Collections>(engine: Engine, options: WatchOptions): Promise<Watcher<T>> => {
    // initial build (sets engine.config); failures reject the watch() promise
    const initial = await engine.build(options)
    if (options.onBuild != null) {
      await options.onBuild({ type: 'success', result: initial as BuildResult<T>, diagnostics: engine.diagnostics })
    }

    const project = engine.config
    if (project == null) fail('internal', 'engine.config missing — call engine.build() before starting the watcher')

    const { watch } = await import('chokidar')
    const root = project.root
    let configImports = project.config.dependencies
    let patterns = Object.values(project.collections).flatMap(({ pattern }) => (Array.isArray(pattern) ? pattern : [pattern]))

    /** Re-read patterns/config dependencies from the latest resolved project (after a reload). */
    const refreshFromProject = (): void => {
      const latest = engine.config
      if (latest == null) return
      configImports = latest.config.dependencies
      patterns = Object.values(latest.collections).flatMap(({ pattern }) => (Array.isArray(pattern) ? pattern : [pattern]))
    }

    const handle: { active: boolean; chokidar?: { close(): Promise<void> } } = { active: true }

    // serialized rebuild queue
    let running: Promise<void> | undefined
    let pendingPaths = new Set<string>()
    let pendingEvent: RebuildEvent = 'change'
    let reloadPending = false

    const emit = async (event: WatchBuildEvent): Promise<void> => {
      if (options.onBuild != null) {
        try {
          await options.onBuild(event)
        } catch (err) {
          logger.warn?.(`onBuild callback failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    const runReload = async (): Promise<void> => {
      try {
        const result = await engine.build(options)
        await emit({ type: 'success', result, diagnostics: engine.diagnostics })
      } catch (err) {
        const error = err instanceof VeliteError ? err : new VeliteError('internal', { message: err instanceof Error ? err.message : String(err) })
        await emit({ type: 'failure', error, diagnostics: engine.diagnostics })
      } finally {
        // build() resolves a fresh project (and updates engine.config) whether it
        // succeeds or fails, so the watcher must classify subsequent events
        // against the new collection patterns regardless of the run outcome.
        refreshFromProject()
      }
    }

    const runRebuild = async (): Promise<void> => {
      const paths = Array.from(pendingPaths)
      const event = pendingEvent
      pendingPaths = new Set()
      try {
        const result = await engine.rebuild({ event, paths })
        await emit({ type: 'success', result, diagnostics: engine.diagnostics })
      } catch (err) {
        const error = err instanceof VeliteError ? err : new VeliteError('internal', { message: err instanceof Error ? err.message : String(err) })
        await emit({ type: 'failure', error, diagnostics: engine.diagnostics })
      }
    }

    const drain = async (): Promise<void> => {
      if (running != null) return
      while (handle.active && (reloadPending || pendingPaths.size > 0)) {
        if (reloadPending) {
          reloadPending = false
          running = runReload()
        } else {
          running = runRebuild()
        }
        try {
          await running
        } finally {
          running = undefined
        }
      }
    }

    const enqueueContent = (event: RebuildEvent, path: string): void => {
      if (event !== 'add') pendingEvent = event === 'unlink' ? 'unlink' : pendingEvent === 'unlink' ? 'unlink' : 'change'
      pendingPaths.add(path)
      void drain()
    }

    logger.info?.(`watching for changes in '${root}'`)

    const watcher = watch([root, ...configImports], { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } })
    handle.chokidar = watcher

    watcher.on('all', (event, filename) => {
      if (!handle.active) return
      if (event === 'addDir' || event === 'unlinkDir') return
      if (filename == null || typeof filename !== 'string') return

      const fullpath = resolve(root, filename)
      const relative = filename.replaceAll('\\', '/')

      try {
        if (configImports.includes(fullpath)) {
          logger.info?.('velite config changed, reloading...')
          reloadPending = true
          pendingPaths.clear()
          void drain()
          return
        }

        if (matchPatterns(relative, patterns) || matchPatterns(fullpath, patterns, root)) {
          const rebuildEvent: RebuildEvent = event === 'add' || event === 'unlink' ? event : 'change'
          logger.info?.(`changed: '${fullpath}', rebuilding...`)
          enqueueContent(rebuildEvent, fullpath)
          return
        }

        if (engine.hasAssetSource(fullpath)) {
          const owners = engine.invalidateAssetSource(fullpath)
          if (owners.length === 0) return
          logger.info?.(`asset changed: '${fullpath}', rebuilding ${owners.length} owner(s)...`)
          for (const owner of owners) enqueueContent('change', owner)
        }
      } catch (err) {
        logger.warn?.(err instanceof Error ? err.message : String(err))
      }
    })

    return {
      get closed() {
        return !handle.active
      },
      async close() {
        handle.active = false
        if (running != null) {
          try {
            await running
          } catch {
            // in-flight run rolled back
          }
        }
        await handle.chokidar?.close()
      }
    }
  }

  return {
    start(engine, options) {
      return arm(engine, options)
    }
  }
}
