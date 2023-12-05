import { copyFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { assets } from './assets'
import { logger } from './logger'

import type { Collections, Result } from './types'

const emitted = new Map<string, string>()

/**
 * emit file if content changed, reduce disk IO and improve fast refresh in app
 * @param path file path
 * @param content file data
 * @param log log message
 */
export const emit = async (path: string, content: string, log?: string): Promise<void> => {
  if (emitted.get(path) === content) {
    logger.log(`skipped write '${path}' with same content`)
    return
  }
  await writeFile(path, content)
  logger.log(log ?? `wrote '${path}' with ${content.length} bytes`)
  emitted.set(path, content)
}

/**
 * output entry file
 * @param dest output destination directory
 * @param configPath resolved config file path
 * @param collections collection options
 */
export const outputEntry = async (dest: string, configPath: string, collections: Collections): Promise<void> => {
  // generate entry according to `config.collections`
  const configModPath = relative(dest, configPath)
    .replace(/\\/g, '/') // replace windows path separator
    .replace(/\.[mc]?[jt]s$/i, '') // remove extension

  const entry: string[] = []
  const dts: string[] = [`import config from '${configModPath}'\n`]

  Object.entries(collections).map(([name, collection]) => {
    const funcName = `get${name[0].toUpperCase() + name.slice(1)}` // e.g. getPosts
    entry.push(`export const ${funcName} = async () => await import('./${name}.json').then(m => m.default)\n`)
    dts.push(`export type ${collection.name} = NonNullable<typeof config.collections>['${name}']['schema']['_output']`)
    dts.push(`export declare const ${funcName}: () => Promise<${collection.name + (collection.single ? '' : '[]')}>\n`)
  })

  const banner = '// This file is generated by Velite\n\n'

  const entryFile = join(dest, 'index.js')
  await emit(entryFile, banner + entry.join('\n'), `created entry file in '${entryFile}'`)

  const dtsFile = join(dest, 'index.d.ts')
  await emit(dtsFile, banner + dts.join('\n'), `created entry dts file in '${dtsFile}'`)
}

/**
 * output all built result
 * @param dest output destination directory
 * @param result all built result
 */
export const outputData = async (dest: string, result: Result<Collections>): Promise<void> => {
  const begin = performance.now()
  const logs: string[] = []
  await Promise.all(
    Object.entries(result).map(async ([name, data]) => {
      if (data == null) return
      const target = join(dest, name + '.json')
      // TODO: output each record separately to a single file to improve fast refresh performance in app
      await emit(target, JSON.stringify(data, null, 2), `wrote '${target}' with ${data.length ?? 1} ${name}`)
      logs.push(`${data.length ?? 1} ${name}`)
    })
  )
  logger.info(`output ${logs.join(', ')}`, begin)
}

/**
 * output all collected assets
 * @param dest output destination directory
 * @param assets all collected assets
 */
export const outputAssets = async (dest: string): Promise<void> => {
  const begin = performance.now()
  const { length } = await Promise.all(Array.from(assets.entries()).map(([name, from]) => copyFile(from, join(dest, name))))
  logger.info(`output ${length} assets`, begin)
}
