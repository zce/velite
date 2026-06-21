import type { SourcePath } from '../model'

/** Engine input id holding the project file tree snapshot. */
export const TREE = 'tree'

/** Engine input id holding a single source file's bytes. */
export const fileInput = (path: SourcePath): string => `file:${path}`

/** One discovered file in the tree snapshot (before glob filtering). */
export interface TreeFile {
  path: SourcePath
  absPath: string
  stat: { mtimeMs: number; size: number }
}
