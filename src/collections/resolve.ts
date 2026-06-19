import { normalize } from 'node:path'
import { reporter } from 'vfile-reporter'

import { runWithContext } from '../runtime/context'
import { createDiscoverer } from './discover'

import type { BuildSession } from '../runtime/session'
import type { VeliteSchema } from '../schemas'
import type { Discoverer } from './discover'
import type { VeliteFile } from './file'

export interface ResolveResult {
  /** Final per-collection result, ready for the prepare hook. */
  result: Record<string, unknown>
  /** Aggregated vfile reporter output, empty when no diagnostics. */
  report: string
}

export interface Resolver {
  resolve(session: BuildSession): Promise<ResolveResult>
}

export interface ResolverOptions {
  discoverer?: Discoverer
}

const loadFile = async (session: BuildSession, path: string, schema: VeliteSchema): Promise<VeliteFile> => {
  const normalized = normalize(path)
  const file = await session.files.load(normalized, session.config.loaders)

  const isArr = Array.isArray(file.records)
  const list = isArr ? (file.records as unknown[]) : [file.records]

  const parsed = await Promise.all(
    list.map(async (data, index) => {
      const pathPrefix = isArr ? [index] : []

      const parseResult = await runWithContext({ config: session.config, file, store: session.store }, () => schema.safeParseAsync(data))

      if (parseResult.success) return parseResult.data

      parseResult.error.issues.forEach(issue => {
        const source = [...pathPrefix, ...(issue.path ?? [])].map(p => (typeof p === 'number' ? `[${p}]` : String(p))).join('.')
        const message = file.message(issue.message ?? 'Validation error', { source })
        message.fatal = (issue as { fatal?: boolean }).fatal === true || session.config.strict === true
      })
      return undefined
    })
  )

  file.result = isArr ? parsed : parsed[0]
  return file
}

/**
 * Create a content resolver.
 *
 * The resolver:
 *   - asks the discoverer for matching files in each collection,
 *   - loads each file through the session's `FileCache`,
 *   - parses records with `BuildContext`,
 *   - reports vfile diagnostics through `vfile-reporter`,
 *   - assembles the per-collection result respecting `single` mode.
 *
 * It does not write anything to disk; output is the responsibility of
 * `Writer`.
 */
export const createResolver = ({ discoverer = createDiscoverer() }: ResolverOptions = {}): Resolver => ({
  async resolve(session) {
    const { config, logger } = session
    const { root, collections } = config
    const begin = performance.now()

    logger.log(`resolving collections from '${root}'`)

    const entries = await Promise.all(
      Object.entries(collections).map(async ([name, { pattern, schema }]): Promise<[string, VeliteFile[]]> => {
        const collectionBegin = performance.now()
        const paths = await discoverer.discover(root, pattern)
        const files = await Promise.all(paths.map(path => loadFile(session, path, schema)))
        logger.log(`resolve ${paths.length} files matching '${pattern}'`, collectionBegin)
        session.resolved.set(name, files)
        return [name, files]
      })
    )

    const allFiles = entries.flatMap(([, files]) => files)
    const report = reporter(allFiles, { quiet: true })

    if (report.length > 0) {
      logger.warn(`issues:\n${report}`)
      if (config.strict) throw new Error('Schema validation failed.')
    }

    const result = Object.fromEntries(
      entries.map(([name, files]): [string, unknown | unknown[]] => {
        const data = files.flatMap(file => file.result).filter(value => value !== undefined) as unknown[]
        const collection = collections[name]
        if (collection.single) {
          if (data.length === 0) throw new Error(`no data resolved for '${name}' collection`)
          if (data.length > 1) logger.warn(`resolved ${data.length} ${name}, but expected single, using first one`)
          else logger.log(`resolved 1 ${name}`)
          return [name, data[0]]
        }
        logger.log(`resolved ${data.length} ${name}`)
        return [name, data]
      })
    )

    logger.log(`resolved ${Object.keys(result).length} collections`, begin)

    return { result, report }
  }
})
