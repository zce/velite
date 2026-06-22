import type { Path } from '../runtime/path'
import type { FileEvent } from '../runtime/watcher'

export type ChangeKind = 'config' | 'content' | 'ignore'

/**
 * Classify a file event for incremental handling.
 * - config: triggers a safe session reload (full rebuild)
 * - content: patch tree/file inputs under the content root
 * - ignore: output dir and other unrelated paths
 */
export const classifyEvent = (
  event: FileEvent,
  options: { cwd: string; configPath: string; contentRoot: string; outputDir: string; path: Path }
): ChangeKind => {
  const { absPath } = event
  const { cwd, configPath, contentRoot, outputDir, path } = options
  const normalized = path.normalize(absPath)

  if (normalized === path.normalize(configPath)) return 'config'
  if (normalized.startsWith(path.normalize(outputDir) + '/') || normalized === path.normalize(outputDir)) {
    return 'ignore'
  }
  const root = path.normalize(contentRoot)
  if (normalized.startsWith(root + '/') || normalized === root) return 'content'
  // Config dependencies outside content root (future): treat as config for now if under cwd
  if (normalized.startsWith(path.normalize(cwd) + '/')) return 'ignore'
  return 'ignore'
}
