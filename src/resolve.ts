import glob from 'fast-glob'
import micromatch from 'micromatch'
import reporter from 'vfile-reporter'

import { load } from './file'
import { logger } from './logger'
import { outputAssets, outputData } from './output'

import type { Context } from './context'

const resolved = new Map<string, unknown>()

/**
 * resolve collections from content root
 * @param ctx build context
 * @param changed changed file path (relative to content root)
 * @returns resolved entries
 */
export const resolve = async ({ root, output, collections, prepare, complete, cache }: Context, changed?: string): Promise<Record<string, unknown>> => {
  const begin = performance.now()

  cache.clear() // clear need refresh cache

  logger.log(`resolving collections from '${root}'`)

  const tasks = Object.entries(collections).map(async ([name, { pattern, schema, single }]): Promise<[string, any]> => {
    if (changed != null && !micromatch.contains(changed, pattern) && resolved.has(name)) {
      // skip collection if changed file not match
      logger.log(`skipped resolve '${name}', using previous resolved`)
      return [name, resolved.get(name)!]
    }

    const begin = performance.now()

    const paths = await glob(pattern, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
    logger.log(`resolve ${paths.length} files matching '${pattern}'`)

    const files = await Promise.all(paths.map(path => load(path, schema, changed)))

    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(`${name}:\n${report}`)

    const data = files.flatMap(file => file.result).filter(Boolean)

    if (single) {
      if (data.length === 0) throw new Error(`no data resolved for '${name}'`)
      if (data.length > 1) logger.warn(`resolved ${data.length} ${name}, but expected single, using first one`)
      else logger.log(`resolved 1 ${name}`, begin)
      resolved.set(name, data[0])
      return [name, data[0]]
    }

    logger.log(`resolved ${data.length} ${name}`, begin)
    resolved.set(name, data)
    return [name, data]
  })

  const result = Object.fromEntries(await Promise.all(tasks))

  let shouldOutput = true
  // apply prepare hook
  if (typeof prepare === 'function') {
    const begin = performance.now()
    shouldOutput = (await prepare(result)) ?? true
    logger.log(`executed 'prepare' callback got ${shouldOutput}`, begin)
  }

  if (shouldOutput) {
    // emit result if not prevented
    await outputData(output.data, result)
  } else {
    logger.warn(`prevent output by 'prepare' callback`)
  }

  // output all assets
  await outputAssets(output.assets)

  // call complete hook
  if (typeof complete === 'function') {
    const begin = performance.now()
    await complete(result)
    logger.log(`executed 'complete' callback`, begin)
  }

  logger.log(`resolved ${Object.keys(result).length} collections`, begin)

  return result
}
