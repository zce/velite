import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import type { OutputState } from '../core/session'
import type { Logger } from '../runtime/logger'
import type { OutputPlan } from './plan'

export interface Writer {
  writeData(state: OutputState, dataDir: string, plan: Pick<OutputPlan, 'writes'>): Promise<void>
  writeAssets(state: OutputState, assetsDir: string, assets: ReadonlyArray<{ path: string; sourcePath: string }>): Promise<void>
}

export interface WriterOptions {
  writeFile?: (path: string, content: string) => Promise<void>
  copyFile?: (source: string, destination: string) => Promise<void>
  access?: (path: string) => Promise<void>
  rm?: (path: string) => Promise<void>
  mkdir?: (path: string) => Promise<void>
  logger?: Logger
}

/**
 * Create an output writer.
 *
 * The writer is the sole output side-effect boundary: it writes data/type/entry
 * files and copies assets, skips unchanged writes, and deletes stale outputs
 * that are no longer part of the plan.
 */
export const createWriter = (options: WriterOptions = {}): Writer => {
  const write = options.writeFile ?? writeFile
  const copy = options.copyFile ?? copyFile
  const accessFile = options.access ?? access
  const remove = options.rm ?? ((p: string) => rm(p, { recursive: true, force: true }))
  const mkdirp = options.mkdir ?? ((p: string) => mkdir(p, { recursive: true }))
  const logger = options.logger

  const emit = async (target: string, content: string, state: OutputState, kind: string): Promise<void> => {
    if (state.emitted.get(target) === content) {
      try {
        await accessFile(target)
        logger?.debug?.(`skipped write '${target}' with same content`)
        return
      } catch {
        logger?.debug?.(`restoring missing '${target}'`)
      }
    }
    await mkdirp(dirname(target))
    await write(target, content)
    state.emitted.set(target, content)
    logger?.debug?.(`wrote ${kind} '${target}'`)
  }

  return {
    async writeData(state, dataDir, plan) {
      const intended = new Set<string>()
      for (const w of plan.writes) {
        const target = join(dataDir, w.path)
        intended.add(target)
        await emit(target, w.content, state, w.kind)
      }
      // sweep stale data outputs no longer in the plan
      for (const target of Array.from(state.emitted.keys())) {
        if (intended.has(target)) continue
        const rel = relative(dataDir, target)
        if (rel.startsWith('..') || rel === '') continue
        try {
          await remove(target)
          state.emitted.delete(target)
        } catch (err) {
          // Only remove from the emitted map when the file is actually gone
          // (ENOENT) or was successfully deleted. On EPERM/EBUSY/etc. keep
          // the entry so the next build retries the deletion.
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') state.emitted.delete(target)
        }
      }
    },

    async writeAssets(state, assetsDir, assets) {
      const intended = new Set<string>()
      for (const asset of assets) {
        const target = join(assetsDir, asset.path)
        intended.add(target)
        if (state.emitted.get(target) === asset.sourcePath) {
          try {
            await accessFile(target)
            logger?.debug?.(`skipped copy '${target}'`)
            continue
          } catch {
            logger?.debug?.(`restoring missing asset '${target}'`)
          }
        }
        await mkdirp(dirname(target))
        await copy(asset.sourcePath, target)
        state.emitted.set(target, asset.sourcePath)
        logger?.debug?.(`copied asset '${target}'`)
      }
      // sweep stale assets no longer referenced
      for (const target of Array.from(state.emitted.keys())) {
        if (intended.has(target)) continue
        const rel = relative(assetsDir, target)
        if (rel.startsWith('..') || rel === '') continue
        try {
          await remove(target)
          state.emitted.delete(target)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') state.emitted.delete(target)
        }
      }
    }
  }
}
