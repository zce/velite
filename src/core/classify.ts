import { normalize } from './util/path'

import type { FileEvent } from '../runtime/watcher'

type ChangeKind = 'config' | 'content' | 'ignore'

/**
 * Classify a file event for incremental handling.
 * - config: triggers a safe session reload (full rebuild)
 * - content: patch tree/file inputs under the content root
 * - ignore: output dirs (data + assets) and other unrelated paths
 */
export const classifyEvent = (
  event: FileEvent,
  options: { cwd: string; configPath: string; contentRoot: string; outputDir: string; assetsDir: string }
): ChangeKind => {
  const { absPath } = event
  const { cwd, configPath, contentRoot, outputDir, assetsDir } = options
  const normalized = normalize(absPath)

  if (normalized === normalize(configPath)) return 'config'
  if (normalized.startsWith(normalize(outputDir) + '/') || normalized === normalize(outputDir)) {
    return 'ignore'
  }
  if (normalized.startsWith(normalize(assetsDir) + '/') || normalized === normalize(assetsDir)) {
    return 'ignore'
  }
  const root = normalize(contentRoot)
  if (normalized.startsWith(root + '/') || normalized === root) return 'content'
  // Config dependencies outside content root (future): treat as config for now if under cwd
  if (normalized.startsWith(normalize(cwd) + '/')) return 'ignore'
  return 'ignore'
}
