import { createLogger } from '../runtime/logger'
import { createEngine } from './engine'
import { createWatcher } from './watch'

import type { BuildResult, Collections } from '../collections'
import type { Logger } from '../runtime/logger'
import type { BuildOptions } from './engine'
import type { Watcher, WatchOptions } from './watch'

/**
 * Run a one-shot build.
 *
 * Each call creates an isolated build session that is destroyed when the call
 * completes. On failure the promise rejects with a `VeliteError` carrying the
 * structured diagnostics.
 */
export const build = async <TCollections extends Collections = Collections>(options: BuildOptions = {}): Promise<BuildResult<TCollections>> => {
  const engine = createEngine({ logger: options.logger })
  return (await engine.build(options)) as BuildResult<TCollections>
}

/**
 * Build once and keep watching for changes.
 *
 * Creates a watch session, runs an initial build, then listens for file
 * changes and runs serialized incremental rebuilds. Returns a closeable
 * watcher. Watch failures do not auto-close the watcher; call `close()` for a
 * clean shutdown.
 */
export const watch = async <TCollections extends Collections = Collections>(options: WatchOptions = {}): Promise<Watcher<TCollections>> => {
  // Engine and watcher share the same logger so that logLevel changes applied
  // inside engine.build() are visible to the watcher's own logs.
  const logger: Logger & { set?(level: string): void } = options.logger ?? createLogger('info')
  const engine = createEngine({ logger })
  const controller = createWatcher({ logger })
  return (await controller.start(engine, options)) as Watcher<TCollections>
}
