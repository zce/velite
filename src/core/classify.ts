import { normalize } from './util/path'

import type { FileEvent } from '../runtime/watcher'

type ChangeKind = 'config' | 'content' | 'ignore'

/** Paths that decide how a file event is routed. Normalized once by {@link createEventClassifier}. */
export interface ClassifierOptions {
  configPath: string
  configDependencies: readonly string[]
  contentRoot: string
  outputDir: string
  assetsDir: string
}

/**
 * Create a file-event classifier for incremental handling, normalizing the
 * option paths once so each event pays for exactly one `normalize` call.
 * - config: triggers a safe session reload (full rebuild)
 * - content: patch tree/file inputs under the content root
 * - ignore: output dirs (data + assets) and other unrelated paths
 */
export const createEventClassifier = (options: ClassifierOptions): ((event: FileEvent) => ChangeKind) => {
  const configPaths = new Set([normalize(options.configPath), ...options.configDependencies.map(dep => normalize(dep))])
  const outputDir = normalize(options.outputDir)
  const assetsDir = normalize(options.assetsDir)
  const contentRoot = normalize(options.contentRoot)
  const under = (base: string, path: string): boolean => path === base || path.startsWith(base + '/')
  return event => {
    const path = normalize(event.absPath)
    if (configPaths.has(path)) return 'config'
    if (under(outputDir, path) || under(assetsDir, path)) return 'ignore'
    if (under(contentRoot, path)) return 'content'
    return 'ignore'
  }
}
