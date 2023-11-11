import { resolve } from 'node:path'
import { setPublic } from './static'
import type { Collections } from './types'
import type { ZodType } from 'zod'

type Schema = { name: string; pattern: string; fields: ZodType }

type Config = {
  root: string
  output: {
    data: string
    static: string
    base: string
  }
  schemas: { [name: string]: Schema }
  callback: (collections: Collections) => void | Promise<void>
}

type Options = {
  root?: string
  filename?: string
  verbose?: boolean
}

export const resolveConfig = async (options: Options): Promise<Config> => {
  const filename = options.filename ?? 'velite.config.js'
  try {
    const configPath = resolve(filename)
    options.verbose && console.log(`using config '${configPath}'`)
    const config = require(configPath)
    if (options.root != null) config.root = options.root
    setPublic(config.output.static, config.output.base)
    return config
  } catch (err: any) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err
    throw new Error(filename + ' not found in cwd')
  }
}

// export for user config type inference
export const defineConfig = (config: Config): Config => config
