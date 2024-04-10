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
const loaded = new Map<string, File>()

export class File extends VFile {
  config: Config
  private _mdast: Root | undefined
  private _hast: Nodes | undefined
  private _plain: string | undefined

  constructor({ path, config }: { path: string; config: Config }) {
    super({ path })
    this.config = config
  }

  /**
   * Get resolved data from cache
   */
  get records(): unknown {
    return this.data.data
  }

  /**
   * Get content of file
   */
  get content(): string | undefined {
    return this.data.content
  }

  /**
   * Get mdast object from cache
   */
  get mdast(): Root | undefined {
    if (this._mdast != null) return this._mdast
    if (this.content == null) return undefined
    this._mdast = Object.freeze(fromMarkdown(this.content))
    return this._mdast
  }

  /**
   * Get hast object from cache
   */
  get hast(): Nodes | undefined {
    if (this._hast != null) return this._hast
    if (this.mdast == null) return undefined
    this._hast = Object.freeze(raw(toHast(this.mdast, { allowDangerousHtml: true })))
    return this._hast
  }

  /**
   * Get plain text of content from cache
   */
  get plain(): string | undefined {
    if (this._plain != null) return this._plain
    if (this.hast == null) return undefined
    this._plain = toString(this.hast)
    return this._plain
  }

  /**
   * Get meta object from cache
   * @param path file path
   * @returns resolved meta object if exists
   */
  static get(path: string): File | undefined {
    return loaded.get(path)
  }

  /**
   * Create meta object from file path
   * @param options meta options
   * @returns resolved meta object
   */
  static async create({ path, config }: { path: string; config: Config }): Promise<File> {
    const meta = new File({ path, config })
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
  interface ZodMeta extends File {}
}
