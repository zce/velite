import { bundleRequire } from 'bundle-require'
import JoyCon from 'joycon'

import { name } from '../package.json'
import { addLoader, addPlugin } from './loader'
import { init } from './static'

import type { Loader, Plugin } from './loader'
import type { Collections } from './types'
import type { ZodType } from 'zod'

type Schema = {
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
  plugins?: Plugin[]
  callback: (collections: Collections) => void | Promise<void>
}

type Options = {
  root?: string
  filename?: string
  verbose?: boolean
}

const joycon = new JoyCon()

joycon.addLoader({
  test: /\.(js|cjs|mjs|ts)$/,
  load: async filepath => {
    const { mod: config } = await bundleRequire({ filepath })
    return config.default || config
  }
})

export const resolveConfig = async (options: Options = {}): Promise<Config> => {
  const configPaths = [options.filename, name + '.config.js', name + '.config.ts'].filter(Boolean) as string[]

  const { data: config, path } = await joycon.load(configPaths)

  options.verbose && console.log(`using config '${path}'`)

  if (options.root != null) config.root = options.root

  if (config.loaders != null) {
    config.loaders.forEach((loader: Loader) => addLoader(loader))
  }

  if (config.plugins != null) {
    config.plugins.forEach((plugin: Plugin) => addPlugin(plugin))
  }

  init(config.output.static, config.output.base)

  return config
}

// export for user config type inference
export const defineConfig = (config: Config): Config => config
