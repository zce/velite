import { z } from 'zod'

import { processMarkdown } from '../content/markdown'
import { processMdx } from '../content/mdx'
import { extractText, extractToc, parseMarkdown } from '../content/reference'
import { posix } from '../util/path'
import { context } from './context'

import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../content/markdown'
import type { ProcessMdxOptions } from '../content/mdx'
import type { TocItem } from '../content/reference'
import type { Schema } from './s'

/**
 * ISO date string schema.
 *
 * Validates a parseable date string and normalizes it to a UTC ISO timestamp.
 * Pure: no context, no I/O — safe to use in any runtime-agnostic schema.
 */
export const isodate = (): Schema<string> =>
  z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date string')
    .transform<string>(value => new Date(value).toISOString())

// ---------------------------------------------------------------------------
// Content schemas — markdown / mdx / toc / excerpt
//
// Each reads the current file's body via `context().file.content` (lazily parsed
// to mdast/hast/plain as needed) and falls back to an explicit field value when
// one is provided. Asset copying (copyLinkedFiles) is deferred to M5.
// ---------------------------------------------------------------------------

/** Options for the {@link markdown} schema. */
export interface MarkdownSchemaOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
}

/** Render the current content body to HTML. */
export const markdown = (options: MarkdownSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, project } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      const g = project.markdown
      const merged: MarkdownOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])]
      }
      try {
        const { html } = await processMarkdown(body, merged)
        return html
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Options for the {@link mdx} schema. */
export interface MdxSchemaOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove `/* ... *​/` comments from mdx expressions. @default true */
  removeComments?: boolean
  /** Minify the output code via terser. @default true */
  minify?: boolean
  /** Output format to generate. @default 'function-body' */
  outputFormat?: 'program' | 'function-body'
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
  /** Enable development-friendly output. @default false */
  development?: boolean
}

/** Compile the current content body as MDX. */
export const mdx = (options: MdxSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, project } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      const g = project.mdx
      const merged: ProcessMdxOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        minify: options.minify ?? g?.minify ?? true,
        outputFormat: options.outputFormat ?? g?.outputFormat ?? 'function-body',
        development: options.development ?? g?.development ?? false,
        remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])],
        path: file.path,
        references: false
      }
      try {
        const { code } = await processMdx(body, merged)
        return code
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Extract a flat table of contents (headings) from the current content. */
export const toc = (): Schema<TocItem[]> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<TocItem[]>(async (value, ctx) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return []
      }
      try {
        return extractToc(parseMarkdown(body))
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Options for the {@link excerpt} schema. */
export interface ExcerptSchemaOptions {
  /** Excerpt length. @default 260 */
  length?: number
}

/** Extract a plain-text excerpt from the current content. */
export const excerpt = ({ length = 260 }: ExcerptSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      try {
        return extractText(parseMarkdown(body), length)
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

// ---------------------------------------------------------------------------
// File schemas — raw / metadata / path
// ---------------------------------------------------------------------------

/** Return the raw content body of the current file. */
export const raw = (): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(value => value ?? context().file.content ?? '')

/** Document metadata: reading time and word count. */
export interface Metadata {
  /** Reading time in minutes. */
  readingTime: number
  /** Word count. */
  wordCount: number
}

// Unicode ranges for Han (Chinese) and Hiragana/Katakana (Japanese) characters.
const cjRanges: ReadonlyArray<readonly [number, number]> = [
  [11904, 11930],
  [11931, 12020],
  [12032, 12246],
  [12293, 12294],
  [12295, 12296],
  [12321, 12330],
  [12344, 12348],
  [13312, 19894],
  [19968, 40939],
  [63744, 64110],
  [64112, 64218],
  [131072, 173783],
  [173824, 177973],
  [177984, 178206],
  [178208, 183970],
  [183984, 191457],
  [194560, 195102],
  [12353, 12439],
  [12445, 12448],
  [110593, 110879],
  [127488, 127489],
  [12449, 12539],
  [12541, 12544],
  [12784, 12800],
  [13008, 13055],
  [13056, 13144],
  [65382, 65392],
  [65393, 65438],
  [110592, 110593]
]

const isCjChar = (char: string): boolean => {
  const charCode = char.codePointAt(0) ?? 0
  return cjRanges.some(([from, to]) => charCode >= from && charCode < to)
}

const wordLength = (str: string): number => {
  const reWord = /['’]?([a-zA-Z]+(?:['’]?[a-zA-Z]+)*)/g
  const words = str.match(reWord) || []
  return words.length
}

/** Compute reading-time metadata from the current content. */
export const metadata = (): Schema<Metadata> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<Metadata>(async (value, ctx) => {
      const body = value ?? context().file.plain
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return { readingTime: 0, wordCount: 0 }
      }
      const avgWPM = 265
      const latinChars: string[] = []
      const cjChars: string[] = []
      for (const char of body) {
        if (isCjChar(char)) cjChars.push(char)
        else latinChars.push(char)
      }
      const wordCount = wordLength(latinChars.join('')) + cjChars.length * 0.56
      const time = Math.round(wordCount / avgWPM)
      return { readingTime: time === 0 ? 1 : time, wordCount }
    })

/** Options for the flattened {@link path} schema. */
export interface PathSchemaOptions {
  /**
   * Remove a trailing `/index` segment from the flattened path.
   * @default true
   */
  removeIndex?: boolean
}

/**
 * Flattened path schema derived from the current file's project-relative path.
 */
export const path = (options?: PathSchemaOptions): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(() => {
      const { project, file } = context()
      const flattened = posix.relative(project.root, file.path).replace(/\.[^.]+$/, '')
      return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
    })

// ---------------------------------------------------------------------------
// Asset schemas — file / image
//
// Resolve content-relative references through the engine's asset derivation
// (two-pass: placeholder url first, content-hashed url + probed metadata once
// the driver feeds the bytes). Emit `AssetReferenceEffect`s the driver consumes.
// ---------------------------------------------------------------------------

export { file } from './file'
export type { FileSchemaOptions } from './file'
export { image } from './image'
export type { ImageData, ImageSchemaOptions } from './image'

// ---------------------------------------------------------------------------
// Cross-file uniqueness schemas — unique / slug
//
// Both register a `UniqueEffect` via `collectEffect`; the pipeline's
// `uniqueCheck` aggregation derivation (not the schema) detects conflicts. This
// keeps cross-file uniqueness correct under concurrent/incremental builds
// without schemas mutating shared state. Ported from the pre-refactor
// `src/schemas/{unique,slug}.ts`.
// ---------------------------------------------------------------------------

/**
 * Unique-value schema.
 *
 * Registers the value as a `unique` schema effect owned by the current record.
 * The pipeline's `uniqueCheck` derivation reports a duplicate diagnostic when
 * the same `(group, value)` is registered by more than one live record.
 *
 * @param group unique group namespace. @default 'global'
 */
export const unique = (group: string = 'global'): Schema<string> =>
  z.string().superRefine(value => {
    const ctx = context()
    ctx.collectEffect({ type: 'unique', owner: ctx.record.id, group, value })
  })

/**
 * Slug schema.
 *
 * Validates a URL-safe slug, rejects reserved values, and registers it in a
 * uniqueness group (prefixed with `slug:`) so duplicates across records are
 * flagged by `uniqueCheck`.
 *
 * @param group unique group namespace. @default 'global'
 * @param reserved reserved slugs that will be rejected.
 */
export const slug = (group: string = 'global', reserved: string[] = []): Schema<string> =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .and(unique(`slug:${group}`))
