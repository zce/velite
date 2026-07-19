// Shared projection schema builders for the Markdown and MDX dialect roots.
//
// `toc()`, `excerpt(options?)`, and `metadata()` are the three projection
// methods exposed by both `MarkdownRoot` and `MdxRoot`. The transform bodies
// are identical modulo the dialect/profile descriptor carried in each content
// request; this module parameterises that one difference and returns the
// three sibling-schema factories a root uses to install its methods.
//
// Velite-owned: the projection transforms demand a dialect-correct mdast
// through the private `contentContext()` capability, with a transitional
// fallback to direct `parseMarkdown` when the capability returns nothing
// (the test stub `contentOperation: async () => undefined`).
//
// Internal — not exported from the schema barrel.

import { z } from 'zod'

import { extractText, extractToc, parseMarkdown } from '../content/reference'
import { isVeliteError } from '../diagnostic'
import { contentContext } from './content-context'
import { context } from './context'
import { computeMetadata } from './metadata'

import type { Root as Mdast } from 'mdast'
import type { TocItem } from '../content/reference'
import type { ExcerptSchemaOptions } from './excerpt'
import type { Metadata } from './metadata'
import type { Schema } from './s'

/** The dialect/profile descriptor a root passes to each projection. */
export interface DialectProfile {
  readonly dialect: 'markdown' | 'mdx'
  /** The effective parse profile for the current record parse (evaluated lazily on each projection demand). */
  readonly profile: () => unknown
}

type AddIssue = (i: { code: 'custom'; message: string; fatal?: boolean }) => void

/** Resolve the selected text and run the empty-input guard (no parse work on empty). */
const selectText = (value: string | undefined, addIssue: AddIssue): string | null => {
  const body = value ?? context().file.content
  if (body == null || body.length === 0) {
    addIssue({ code: 'custom', message: 'The content is empty' })
    return null
  }
  return body
}

/** Demand a dialect-correct mdast for the selected text via the private content capability (Velite-owned). */
const demandMdast = async (text: string, dp: DialectProfile): Promise<Mdast | undefined> => {
  const capability = contentContext()
  const result = await capability.content({ kind: 'mdast', text, path: context().file.path, dialect: dp.dialect, profile: dp.profile() })
  return result as Mdast | undefined
}

/** Build the TOC projection schema for a dialect. */
export const buildTocSchema = (dp: DialectProfile): Schema<TocItem[]> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<TocItem[]>(async (value, { addIssue }) => {
      const body = selectText(value, addIssue)
      if (body === null) return []
      try {
        const tree = (await demandMdast(body, dp)) ?? parseMarkdown(body)
        return extractToc(tree)
      } catch (err) {
        if (isVeliteError(err)) throw err
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Build the excerpt projection schema for a dialect. */
export const buildExcerptSchema = (dp: DialectProfile, options: ExcerptSchemaOptions = {}): Schema<string> => {
  const length = options.length ?? 260
  return z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, { addIssue }) => {
      const body = selectText(value, addIssue)
      if (body === null) return ''
      try {
        const tree = (await demandMdast(body, dp)) ?? parseMarkdown(body)
        return extractText(tree, length)
      } catch (err) {
        if (isVeliteError(err)) throw err
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
}

/** Build the metadata projection schema for a dialect. */
export const buildMetadataSchema = (dp: DialectProfile): Schema<Metadata> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<Metadata>(async (value, { addIssue }) => {
      const body = selectText(value, addIssue)
      if (body === null) return { readingTime: 0, wordCount: 0 }
      try {
        const tree = (await demandMdast(body, dp)) ?? parseMarkdown(body)
        return computeMetadata(tree)
      } catch (err) {
        if (isVeliteError(err)) throw err
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
