import nodePosix from 'node:path/posix'
import chokidar from 'chokidar'

import type { FileEvent, Watcher } from '../../watcher'

/** Chokidar adapter for the {@link Watcher} runtime contract. */
export const createChokidarWatcher = (paths: string[]): Watcher => {
  // Created lazily inside subscribe so the watcher instance (and its ready
  // promise) belongs to the subscription lifecycle, not the factory call.
  const pending = new Set(paths)
  let watcher: ReturnType<typeof chokidar.watch> | undefined
  const flushPending = (): void => {
    if (watcher === undefined || pending.size === 0) return
    watcher.add([...pending])
    pending.clear()
  }
  return {
    subscribe(onEvent) {
      watcher = chokidar.watch([...pending], {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
      })
      pending.clear()
      const emit = (type: FileEvent['type'], absPath: string): void => {
        // Normalize at the runtime boundary so the core only ever sees posix
        // paths. Node's path/posix is used directly (the adapter is allowed
        // node:* imports); the core's pure-JS posix util is not imported here
        // to keep the runtime → core dependency direction enforced.
        onEvent({ type, absPath: nodePosix.normalize(absPath) })
      }
      watcher.on('add', p => emit('add', p))
      watcher.on('change', p => emit('change', p))
      watcher.on('unlink', p => emit('unlink', p))
      return () => {
        void watcher?.close()
      }
    },
    add(paths) {
      for (const path of paths) pending.add(path)
      flushPending()
    }
  }
}
