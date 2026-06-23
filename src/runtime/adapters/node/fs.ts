import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { glob } from 'tinyglobby'

import type { FileSystem } from '../../fs'

/** Node filesystem adapter. Uses tinyglobby for directory walking. */
export const createNodeFileSystem = (): FileSystem => ({
  async read(absPath) {
    return readFile(absPath)
  },
  async stat(absPath) {
    const s = await stat(absPath)
    return { mtimeMs: s.mtimeMs, size: s.size }
  },
  async walk(root, options) {
    return glob(options.include, {
      cwd: root,
      absolute: true,
      onlyFiles: true,
      ignore: options.exclude
    })
  },
  async write(absPath, data) {
    await mkdir(dirname(absPath), { recursive: true })
    await writeFile(absPath, data)
  },
  async remove(absPath, options) {
    await rm(absPath, { force: true, recursive: options?.recursive ?? false })
  }
})

export const nodeFileSystem: FileSystem = createNodeFileSystem()
