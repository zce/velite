import nodePosix from 'node:path/posix'
import chokidar from 'chokidar'

import type { FileEvent, Watcher } from '../../watcher'

/** Chokidar adapter for the {@link Watcher} runtime contract. */
export const createChokidarWatcher = (paths: string[]): Watcher => ({
  subscribe(onEvent) {
    const watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
    })
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
      void watcher.close()
    }
  }
})
