// TS consumer smoke test: proves that `import type { ... } from 'velite'`
// resolves through the package's export map and types field. Run via
// `tsc --noEmit` in the dist contract integration test.
//
// If the export map or .d.mts is misconfigured, this file will produce
// compile errors even though the runtime import works fine.
import { content, defineCollection, defineConfig, s } from 'velite'

import type {
  BuildResult,
  ContentFile,
  ContentNamespace,
  ExcerptSchemaOptions,
  Infer,
  MarkdownDefinition,
  MarkdownDefinitionOptions,
  MdxDefinition,
  MdxDefinitionOptions,
  Metadata,
  Schema,
  SchemaContext,
  TocItem,
  UserConfig
} from 'velite'
import type { z } from 'zod'

// Keep negative export checks as type queries so import sorting cannot merge
// declarations and detach their individual @ts-expect-error directives.
// @ts-expect-error Legacy hybrid Markdown roots are removed, not aliased.
type _LegacyMarkdownRoot = import('velite').MarkdownRoot
// @ts-expect-error Legacy hybrid MDX roots are removed, not aliased.
type _LegacyMdxRoot = import('velite').MdxRoot
// @ts-expect-error Definition options replace legacy Markdown schema options.
type _LegacyMarkdownOptions = import('velite').MarkdownSchemaOptions
// @ts-expect-error Definition options replace legacy MDX schema options.
type _LegacyMdxOptions = import('velite').MdxSchemaOptions
// @ts-expect-error There is no standalone TOC option family.
type _LegacyTocOptions = import('velite').TocOptions
// @ts-expect-error There is no aggregate content-result schema protocol.
type _AggregateContentResult = import('velite').ContentResult
// @ts-expect-error Content execution descriptors are private.
type _PrivateContentDescriptor = import('velite').ContentDefinitionDescriptor
// @ts-expect-error Content demand requests are private.
type _PrivateContentRequest = import('velite').SemanticContentRequest
// @ts-expect-error Record-scoped execution factories are private.
type _PrivateContentFactory = import('velite').ContentExecutionsFactory
// @ts-expect-error Record-bound content capabilities are private.
type _PrivateContentCapability = import('velite').RecordContentCapability
// @ts-expect-error Active execution-stage scopes are private.
type _PrivateContentStage = import('velite').ContentStageScope
// @ts-expect-error The ambient host is not a public service.
type _PrivateSchemaHost = import('velite').SchemaContextHost
// @ts-expect-error The leased carrier is distinct from the public context.
type _PrivateSchemaCarrier = import('velite').SchemaRunContext
// @ts-expect-error Pristine artifacts are neither retained nor public.
type _PrivatePristineArtifact = import('velite').PristineArtifact
// @ts-expect-error VFile seed copying is neither retained nor public.
type _PrivateVFileSeed = import('velite').VFileSeed

// Verify the types are usable, not just importable.
type PostSchema = Schema<{ title: string }>
type PostData = Infer<PostSchema>
const _check: PostData = { title: 'test' }

// Verify BuildResult shape — just reference the type, don't construct it
// (LogicalOutput has a complex shape we don't need to exercise here).
type _BR = BuildResult
const _result = {} as _BR
void _result.diagnostics
void _result.written

// Verify SchemaContext has the expected fields.
const _ctx = {} as SchemaContext
void _ctx.project
void _ctx.file
void _ctx.record
void _ctx.store
void _ctx.asset
void _ctx.readFile
void _ctx.probeImage

// Record transactions and leases stay private; the public context retains exactly eight fields.
const _contextFields: Record<keyof SchemaContext, true> = {
  project: true,
  file: true,
  record: true,
  store: true,
  collectEffect: true,
  asset: true,
  readFile: true,
  probeImage: true
}
_ctx.collectEffect({ type: 'unique', group: 'posts', value: 'hello' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } })
_ctx.collectEffect(
  { type: 'asset', source: '/content/hero.png', output: { base: '/static/', template: '[name].[ext]' }, metadata: true },
  { path: ['image'], declaration: 0, occurrence: { kind: 'key', key: 'hero' } }
)
void _contextFields

const _fileFields: Record<keyof ContentFile, true> = { id: true, path: true, content: true }
void _fileFields

// Verify UserConfig shape.
const _config = {} as UserConfig
void _config.root
void _config.collections

defineConfig({
  collections: {
    posts: defineCollection({ pattern: 'posts/*.json', schema: s.object({ title: s.string(), draft: s.boolean().default(false) }) }),
    site: defineCollection({ pattern: 'site.json', single: true, schema: s.object({ name: s.string() }) })
  },
  prepare: ({ posts, site }) => {
    const title: string = posts[0]!.title
    const draft: boolean = posts[0]!.draft
    const siteName: string = site.name

    // @ts-expect-error unknown collection keys are not available in the typed prepare view
    posts[0]!.missing
    // @ts-expect-error single collections are objects, not arrays
    site.push({ name: 'x' })

    void title
    void draft
    void siteName
  }
})

void _check

const _namespace: ContentNamespace = content
const _contentFactories: Record<keyof ContentNamespace, true> = { markdown: true, mdx: true }
const _markdownFactories: Record<keyof MarkdownDefinition, true> = { html: true, toc: true, excerpt: true, metadata: true }
const _mdxFactories: Record<keyof MdxDefinition, true> = { code: true, toc: true, excerpt: true, metadata: true }
const _markdownOptions: MarkdownDefinitionOptions = { gfm: false, removeComments: false, copyLinkedFiles: false, remarkPlugins: [], rehypePlugins: [] }
const _mdxOptions: MdxDefinitionOptions = { ..._markdownOptions, minify: false, outputFormat: 'program', development: true, recmaPlugins: [] }
void [_namespace, _contentFactories, _markdownFactories, _mdxFactories, _markdownOptions, _mdxOptions]

// @ts-expect-error Content factories no longer live on the Zod namespace.
s.markdown
// @ts-expect-error Content factories no longer live on the Zod namespace.
s.mdx
// @ts-expect-error Standalone inferred-dialect TOC is removed.
s.toc
// @ts-expect-error Standalone inferred-dialect excerpt is removed.
s.excerpt
// @ts-expect-error Standalone inferred-dialect metadata is removed.
s.metadata
// @ts-expect-error There is no alternate s.content API family.
s.content

const definition: MarkdownDefinition = content.markdown()
const sourceSchema = definition.metadata()
const _sourceInput: z.input<typeof sourceSchema> = undefined
const _sourceOutput: z.output<typeof sourceSchema> = { readingTime: 1, wordCount: 2.56 }
const _metadata: Metadata = _sourceOutput
// @ts-expect-error Content Definitions are not schemas
definition.parse('text')
// @ts-expect-error Ordinary source result inputs reject numbers
const _invalidSourceInput: z.input<typeof sourceSchema> = 42
// @ts-expect-error Metadata output is not any
const _invalidSourceOutput: z.output<typeof sourceSchema> = 'text'
void [_sourceInput, _sourceOutput, _metadata, _invalidSourceInput, _invalidSourceOutput]

const htmlSchema = definition.html()
const _htmlInput: z.input<typeof htmlSchema> = '# Title'
const _htmlOutput: z.output<typeof htmlSchema> = '<h1 id="title">Title</h1>'
// @ts-expect-error Markdown definitions do not expose MDX code generation.
definition.code()
// @ts-expect-error HTML output is not any
const _invalidHtmlOutput: z.output<typeof htmlSchema> = { html: 'not a string' }
void [_htmlInput, _htmlOutput, _invalidHtmlOutput]

const mdxDefinition: MdxDefinition = content.mdx({ outputFormat: 'program', recmaPlugins: [] })
const codeSchema = mdxDefinition.code()
const _codeInput: z.input<typeof codeSchema> = undefined
const _codeOutput: z.output<typeof codeSchema> = 'export default 1'
// @ts-expect-error Dialect methods do not form a hybrid root
mdxDefinition.html()
// @ts-expect-error MDX output is not any
const _invalidCodeOutput: z.output<typeof codeSchema> = 123
void [_codeInput, _codeOutput, _invalidCodeOutput]

const tocSchema = definition.toc()
const _tocInput: z.input<typeof tocSchema> = undefined
const _tocOutput: z.output<typeof tocSchema> = [{ depth: 2, title: 'Title', id: 'actual-target' }]
const _tocItem: TocItem = _tocOutput[0]!
// @ts-expect-error Navigation has actual IDs, not legacy source slugs
const _invalidTocOutput: z.output<typeof tocSchema> = [{ depth: 1, title: 'Title', slug: 'title' }]
// @ts-expect-error No TOC option family
definition.toc({ original: true })
void [_tocInput, _tocOutput, _tocItem, _invalidTocOutput]

const mdxTocSchema = mdxDefinition.toc()
const _mdxTocOutput: z.output<typeof mdxTocSchema> = [{ depth: 1, title: 'Static JSX', id: 'static-jsx' }]
void _mdxTocOutput

const _excerptOptions: ExcerptSchemaOptions = { length: 2 }
const excerptSchema = definition.excerpt(_excerptOptions)
const _excerptInput: z.input<typeof excerptSchema> = undefined
const _excerptOutput: z.output<typeof excerptSchema> = 'A😀…'
// @ts-expect-error Excerpt output is exactly a string before native wrappers.
const _invalidExcerptOutput: z.output<typeof excerptSchema> = undefined
void [_excerptInput, _excerptOutput, _invalidExcerptOutput]

const articleSchema = s.object({
  html: definition.html(),
  toc: definition.toc(),
  excerpt: definition.excerpt(),
  metadata: definition.metadata(),
  optional: definition.excerpt().optional()
})
const _article: Infer<typeof articleSchema> = {
  html: '<h1 id="title">Title</h1>',
  toc: [{ depth: 1, title: 'Title', id: 'title' }],
  excerpt: 'Title',
  metadata: { readingTime: 1, wordCount: 1 },
  optional: undefined
}
void _article
