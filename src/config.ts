import { bundleRequire } from 'bundle-require'
import JoyCon from 'joycon'

import { name } from '../package.json'
import { addLoader } from './loader'
import { init } from './static'

import type { Loader } from './loader'
import type { Collections } from './types'
import type { ZodType } from 'zod'

type Schema = {
  name: string
  pattern: string
  single?: boolean
  fields: ZodType
}

type Config = {
  root: string
  output: {
    data: string
    static: string
    base: string
  }
  image?: {
    sizes?: number[]
    quality?: number
  }
  schemas: { [name: string]: Schema }
  loaders?: Loader[]
  callback: (collections: Collections) => void | Promise<void>
}

type Options = {
  root?: string
  filename?: string
  verbose?: boolean
}

const joycon = new JoyCon()

export const resolveConfig = async (options: Options = {}): Promise<Config> => {
  const configPaths = [options.filename, name + '.config.js', name + '.config.ts'].filter(Boolean) as string[]

  joycon.addLoader({
    test: /\.(js|cjs|mjs|ts)$/,
    load: async filepath => {
      const { mod: config } = await bundleRequire({ filepath })
      return config.default || config
    }
  })

  const { data: config, path } = await joycon.load(configPaths)

  options.verbose && console.log(`using config '${path}'`)

  if (options.root != null) config.root = options.root

  if (config.loaders != null) {
    config.loaders.forEach((loader: Loader) => addLoader(loader))
  }

  init(config.output.static, config.output.base)

  return config
}

// export for user config type inference
export const defineConfig = (config: Config): Config => config
