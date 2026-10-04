import { z } from 'zod'

import { isVeliteError } from '../diagnostic'
import { contentContext } from './content-context'
import { context } from './context'

import type { ZodType } from 'zod'
import type { ContentDefinitionDescriptor, SemanticContentRequest } from '../content/execution/types'
import type { MarkdownOptions, MdxOptions } from '../content/options'
import type { ExcerptSchemaOptions, Metadata, TocItem } from '../content/results'

export interface MarkdownDefinitionOptions extends MarkdownOptions {}
export interface MdxDefinitionOptions extends MdxOptions {}

export interface MarkdownDefinition {
  html(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}

export interface ContentNamespace {
  readonly markdown: (options?: MarkdownDefinitionOptions) => MarkdownDefinition
  readonly mdx: (options?: MdxDefinitionOptions) => MdxDefinition
}

export interface MdxDefinition {
  code(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}

const failureMessage = (error: unknown): string => {
  try {
    return error instanceof Error ? String(error.message) : String(error)
  } catch {
    return 'Content processing failed'
  }
}

const isInternalFailure = (error: unknown): boolean => {
  try {
    return isVeliteError(error) && error.code === 'internal'
  } catch {
    // A plugin may throw a revoked proxy or an Error with hostile accessors.
    // Inspecting that ordinary failure must not create a new invariant fault.
    return false
  }
}

const resultSchema = <T>(
  definition: ContentDefinitionDescriptor,
  selection: SemanticContentRequest['selection'],
  length?: number
): ZodType<T, string | undefined> =>
  z
    .string()
    .optional()
    .transform<T>((value, ctx) => {
      const text = value ?? context().file.content
      if (text === undefined || text === '') {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return z.NEVER
      }
      const demand = contentContext().content({ definition, text, selection, length })
      return demand.then(
        value => value as T,
        error => {
          if (isInternalFailure(error)) throw error
          ctx.addIssue({ code: 'custom', message: failureMessage(error) })
          return z.NEVER
        }
      )
    })

const defineContent = (dialect: ContentDefinitionDescriptor['dialect'], options: MdxOptions) => {
  const definition: ContentDefinitionDescriptor = {
    dialect,
    options: {
      ...options,
      remarkPlugins: [...(options.remarkPlugins ?? [])],
      rehypePlugins: [...(options.rehypePlugins ?? [])],
      recmaPlugins: [...(options.recmaPlugins ?? [])]
    }
  }
  return {
    primary: () => resultSchema<string>(definition, dialect === 'mdx' ? 'code' : 'html'),
    toc: () => resultSchema<TocItem[]>(definition, 'toc'),
    excerpt(options: ExcerptSchemaOptions = {}) {
      const length = options.length === undefined ? 260 : options.length
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) throw new TypeError('Excerpt length must be a non-negative safe integer')
      return resultSchema<string>(definition, 'excerpt', length)
    },
    metadata: () => resultSchema<Metadata>(definition, 'metadata')
  }
}

export const content: ContentNamespace = {
  markdown(options = {}) {
    const { primary, ...source } = defineContent('markdown', options)
    return { html: primary, ...source }
  },
  mdx(options = {}) {
    const { primary, ...source } = defineContent('mdx', options)
    return { code: primary, ...source }
  }
}
