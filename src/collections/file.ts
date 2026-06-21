import { readFile } from 'node:fs/promises'
import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

import { fail } from '../core/errors'
import { matchesLoader } from '../loaders/types'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { Loader } from '../loaders/types'
import type { ContentFile } from '../schemas/context'

/** A raw record produced by a loader, with its body content attached. */
export interface LoadedRecord {
  /** Stable record key forming part of the record identity. */
  key?: string
  /** Raw record data awaiting schema validation. */
  data: unknown
  /** Body content (e.g. Markdown body after frontmatter stripping). */
  content?: string
  /** Loader-specific metadata. */
  metadata?: Record<string, unknown>
}

/** A fully loaded source file ready for schema validation. */
export interface LoadedFile {
  /** Absolute source path. */
  path: string
  /** Stable source id (project-relative, POSIX). */
  id: string
  /** Raw records produced by the loader. */
  records: LoadedRecord[]
  /** Additional source dependencies declared by the loader. */
  dependencies: string[]
  /** Source-level metadata. */
  metadata?: Record<string, unknown>
}

/**
 * Read `path` and run the first matching loader.
 *
 * @throws when no loader matches the path or the loader returns no records.
 */
export const loadFile = async (path: string, loaders: readonly Loader[], sourceId: string): Promise<LoadedFile> => {
  const buffer = await readFile(path)
  const source = { id: sourceId, path, content: buffer }
  const loader = loaders.find(l => matchesLoader(l, source))
  if (loader == null) fail('load', { message: `no loader found for '${path}'`, context: { path } })

  const result = await loader.load(source, { source })
  const records = result.records.map(record => ({
    key: record.key,
    data: record.data,
    content: typeof record.metadata?.content === 'string' ? record.metadata.content : undefined,
    metadata: record.metadata
  }))
  if (records.length === 0) fail('load', { message: `no records loaded from '${path}'`, context: { path } })

  return { path, id: sourceId, records, dependencies: result.dependencies ?? [], metadata: result.metadata }
}

/**
 * Create a schema-context content file with lazily-parsed AST.
 *
 * `mdast`, `hast` and `plain` are derived on first access from `content` and
 * cached. All schemas (built-in and user-defined) access them via `context()`.
 */
export const createContentFile = (id: string, path: string, content?: string): ContentFile => {
  let mdastCache: Root | undefined
  let hastCache: Nodes | undefined
  let plainCache: string | undefined

  const file: ContentFile = {
    id,
    path,
    content,
    get mdast(): Root | undefined {
      if (mdastCache != null) return mdastCache
      if (content == null) return undefined
      mdastCache = Object.freeze(fromMarkdown(content))
      return mdastCache
    },
    get hast(): Nodes | undefined {
      if (hastCache != null) return hastCache
      const mdast = this.mdast
      if (mdast == null) return undefined
      hastCache = Object.freeze(raw(toHast(mdast, { allowDangerousHtml: true })))
      return hastCache
    },
    get plain(): string | undefined {
      if (plainCache != null) return plainCache
      const hast = this.hast
      if (hast == null) return undefined
      plainCache = toString(hast)
      return plainCache
    }
  }
  return file
}
