import { readFile } from 'node:fs/promises'
import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'
import { VFile } from 'vfile'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { VeliteLoader } from '../loaders/types'
import type { ContentFile } from '../runtime/context'

/**
 * `VeliteFile` is the in-memory representation of a content file once it has
 * been read from disk and passed through a loader.
 *
 * It is a pure data object: it does not own a cache. File caching belongs to
 * the session-scoped `FileCache` (see `src/runtime/session.ts`). Use
 * `VeliteFile.create()` to read a file and run its loader.
 */
export class VeliteFile extends VFile implements ContentFile {
  private _mdast: Root | undefined
  private _hast: Nodes | undefined
  private _plain: string | undefined

  /** Get parsed records from file. */
  get records(): unknown {
    return this.data.data
  }

  /** Get content of file. */
  get content(): string | undefined {
    return this.data.content
  }

  /** Get mdast object from cache. */
  get mdast(): Root | undefined {
    if (this._mdast != null) return this._mdast
    if (this.content == null) return undefined
    this._mdast = Object.freeze(fromMarkdown(this.content))
    return this._mdast
  }

  /** Get hast object from cache. */
  get hast(): Nodes | undefined {
    if (this._hast != null) return this._hast
    if (this.mdast == null) return undefined
    this._hast = Object.freeze(raw(toHast(this.mdast, { allowDangerousHtml: true })))
    return this._hast
  }

  /** Get plain text of content from cache. */
  get plain(): string | undefined {
    if (this._plain != null) return this._plain
    if (this.hast == null) return undefined
    this._plain = toString(this.hast)
    return this._plain
  }

  /**
   * Read `path` and run the matching loader. Throws via `vfile.fail()` when no
   * loader matches or the loader returns no data.
   */
  static async create(path: string, loaders: VeliteLoader[]): Promise<VeliteFile> {
    const loader = loaders.find(l => l.test.test(path))
    const file = new VeliteFile({ path })
    if (loader == null) return file.fail(`no loader found for '${path}'`)
    file.value = await readFile(path)
    file.data = await loader.load(file)
    if (file.data?.data == null) return file.fail(`no data loaded from '${path}'`)
    return file
  }
}
