import { readFile } from 'node:fs/promises'
import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'
import { VFile } from 'vfile'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { Config } from './types'

// cache loaded files for rebuild
export const loaded = new Map<string, VeliteMeta>()

export class VeliteMeta extends VFile {
  config: Config
  private _mdast: Root | undefined
  private _hast: Nodes | undefined
  private _plain: string | undefined

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

  get mdast(): Root | undefined {
    if (this._mdast != null) return this._mdast
    if (this.content == null) return undefined
    this._mdast = Object.freeze(fromMarkdown(this.content))
    return this._mdast
  }

  get hast(): Nodes | undefined {
    if (this._hast != null) return this._hast
    if (this.mdast == null) return undefined
    this._hast = Object.freeze(raw(toHast(this.mdast, { allowDangerousHtml: true })))
    return this._hast
  }

  get plain(): string | undefined {
    if (this._plain != null) return this._plain
    if (this.hast == null) return undefined
    this._plain = toString(this.hast)
    return this._plain
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
