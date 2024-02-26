import { readFile } from 'node:fs/promises'
import { VFile } from 'vfile'

import { ZodMeta } from './schemas'

import type { Config } from './types'

// cache loaded files for rebuild
export const loaded = new Map<string, VeliteMeta>()

export class VeliteMeta extends VFile {
  config: Config

  constructor({ path, config }: { path: string; config: Config }) {
    super({ path })
    this.config = config
  }

  get records(): unknown {
    return this.data.data
  }

  get content(): string | undefined {
    return this.data.content
  }

  get plain(): string | undefined {
    return this.data.plain
  }

  static async create({ path, config }: { path: string; config: Config }): Promise<VeliteMeta> {
    const meta = new VeliteMeta({ path, config })
    const loader = config.loaders.find(loader => loader.test.test(path))
    if (loader == null) return meta.fail(`no loader found for '${path}'`)
    meta.value = await readFile(path)
    meta.data = await loader.load(meta)
    if (meta.data?.data == null) return meta.fail(`no data loaded from '${path}'`)
    loaded.set(path, meta)
    return meta
  }
}

declare module './schemas' {
  interface ZodMeta extends VeliteMeta {}
}
