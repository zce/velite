import chokidar from 'chokidar'

import { nodePath as posix } from './path'

import type { FileEvent, Watcher } from '../runtime/watcher'

/** Chokidar adapter for the {@link Watcher} runtime contract. */
export const createChokidarWatcher = (paths: string[]): Watcher => ({
  subscribe(onEvent) {
    const watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
    })
    const emit = (type: FileEvent['type'], absPath: string): void => {
      onEvent({ type, absPath: posix.normalize(absPath) })
    }
    watcher.on('add', p => emit('add', p))
    watcher.on('change', p => emit('change', p))
    watcher.on('unlink', p => emit('unlink', p))
    return () => {
      void watcher.close()
    }
  }
})
