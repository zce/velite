# Content definitions and build-time navigation

Create a definition with `content.markdown(options)` or `content.mdx(options)`, then use its ordinary Zod result schemas. Reuse the same definition for the outputs that should describe one selected input in one record.

```ts
import { content, s } from 'velite'

const postContent = content.mdx()
const schema = s.object({
  code: postContent.code(),
  toc: postContent.toc(),
  excerpt: postContent.excerpt({ length: 160 }),
  metadata: postContent.metadata()
})
```

The definition is configuration plus identity, not a Zod schema. Call `.optional()`, `.transform()`, `.catch()`, and other Zod methods on a result schema, not on the definition. Markdown provides `.html()`; MDX provides `.code()`. Both provide `.toc()`, `.excerpt(options?)`, and `.metadata()`. Each result schema accepts `string | undefined` and requires asynchronous parsing within Velite's record context. The `s` namespace remains available for Zod and the other Velite built-ins.

## Explicit reuse and input selection

Sharing requires the same definition, the exact selected string, and the same actual record-validation attempt. Separate `content.markdown()` calls remain independent even with identical options. Aliasing a definition or extracting one of its methods preserves its identity. Different selected strings under one definition remain independent; there is no cross-record content cache.

Each field selects its own input:

| Input                                  | Selection                                          |
| -------------------------------------- | -------------------------------------------------- |
| Primitive string                       | Use it instead of the file body                    |
| Absent field / `undefined`             | Use `context().file.content`                       |
| Other input, including `null`          | Ordinary field-local input error; no body fallback |
| Missing or exactly empty selected text | Issue `The content is empty`; no processor work    |
| Non-empty whitespace-only text         | Process normally                                   |

An explicit `''` never falls back to the file body. Equal explicit and fallback strings share under one definition; differently selected frontmatter fields do not necessarily describe the same document. Definition/schema construction starts no processing.

## Configuration

Keep project-wide defaults under `defineConfig({ markdown: {...}, mdx: {...} })`. Definition options override those defaults for that definition. Scalars resolve as `definition option ?? global option ?? built-in default`, so explicit `false` overrides global `true`.

| Options                                                   | Built-in defaults                  |
| --------------------------------------------------------- | ---------------------------------- |
| Both dialects: `gfm`, `removeComments`, `copyLinkedFiles` | `true`                             |
| Both dialects: `remarkPlugins`, `rehypePlugins`           | `[]`                               |
| MDX: `minify`, `outputFormat`, `development`              | `true`, `'function-body'`, `false` |
| MDX: `recmaPlugins`                                       | `[]`                               |

Within each user-plugin phase, definition-local registrations run before global registrations, preserving list order and ordinary Unified registration semantics. Repeated registrations may be merged by Unified; Velite does not infer sharing or clone opaque plugin arguments. Treat established configuration as immutable and use config reload to change it. Processing options belong to the definition; only excerpt length is selection-specific. TOC and metadata take no options.

## Source Analysis versus navigation

Source excerpts and metadata describe static **pre-transform source text**, even when requested after generated content. They include ordinary text, inline-code text, and known JSX text children, while excluding expressions, imports/exports, attributes, comments, and component names. Text fragments are joined with spaces, whitespace is collapsed, and leading/trailing whitespace is removed. Non-empty source with no static visible text yields excerpt `''` and metadata `{ readingTime: 1, wordCount: 0 }`.

Excerpt length defaults to 260 Unicode code points. It must be a non-negative safe integer; invalid length configuration throws `TypeError` when constructing the schema. Truncation trims trailing whitespace and appends `…` outside the requested length without splitting a valid surrogate pair. Metadata uses the complete normalized source text, not the excerpt: Latin word runs plus the fixed CJK character count weighted by `0.56`; reading time is `Math.max(1, Math.round(wordCount / 265))`. See [ADR 0002](https://github.com/zce/velite/blob/main/.adr/0002-content-definition-and-anchor-contract.md#source-analysis-value-oracle) for the exact Unicode rules.

Navigation instead follows **transformed build-time content**. Plugins can add, remove, rename, reorder, or retarget headings without changing source excerpts or metadata.

## Actual heading targets

Navigation is a flat array of `{ depth, title, id }` describing transformed build-time headings and their actual targets. Static intrinsic JSX headings participate; unknown components do not. Dynamic heading titles, expression-valued IDs, and spread-bearing targets are omitted with warnings only when navigation is requested. No expressions, imports, generated JavaScript, or components are evaluated for analysis.

Automatic anchors are assigned during transformation even for HTML-only or code-only output. Legal explicit IDs are preserved, reserved across all content elements, and are the supported stable external-link contract. An explicit ID must be non-empty, contain no HTML ASCII whitespace, and be unique within the analyzed content. Duplicate or invalid explicit IDs are recoverable content validation errors, not silently renamed targets. Automatic IDs use normalized lowercase Unicode titles with deterministic collision suffixes; three `Intro` headings receive `intro`, `intro-1`, and `intro-2` unless other explicit targets reserve those values. Automatic duplicate suffixes can change when headings or explicit targets are inserted.

Use `item.id`, not a separately calculated title slug, to link to content:

```tsx
const links = post.toc.map(item => (
  <a key={item.id} href={`#${encodeURIComponent(item.id)}`}>
    {item.title}
  </a>
))
```

Here `post` is a generated record, not the Content Definition. The ID contains no leading `#`; encode it for URLs and escape it separately when constructing a CSS selector.

MDX navigation requires the complete transform, including recma. A later recma failure withholds navigation even if content-phase capture succeeded. TOC-only skips serialization and minification but may perform plugin I/O and resolve linked assets.

Code-level plugins must preserve the captured heading order, levels, titles, and targets. Runtime heading components that replace intrinsic headings must forward the generated `id` to the actual heading element. Navigation makes no guarantee about surrounding layouts, CSS visibility, arbitrary runtime DOM, or component/spread behavior.

```tsx
import type { ComponentProps } from 'react'

const components = {
  h2: ({ id, children, ...props }: ComponentProps<'h2'>) => (
    <h2 {...props} id={id}>
      {children}
    </h2>
  )
}
```

For example, `<h2 id="details">Details</h2>` is static, but `<h2 id={'details'}>Details</h2>` and `<h2 {...props}>Details</h2>` have dynamic targets. `<h2>{title}</h2>` has a dynamic title. These expressions remain untouched, and their headings are omitted from TOC; Velite never executes them to guess a target or title. `<Heading>` is an unknown component, not an inferred heading.

A runtime-dependent intrinsic descendant can also make the complete title unknown: `<h1>Known <span {...runtimeProps} /></h1>` is omitted rather than reported as the partial title `Known`. By contrast, `<h1>Known <span>More</span></h1>` has the static title `Known More`. Attributes are not another source of title text. Limitation warnings are emitted once per execution only when TOC is requested, including after code has already completed. Legal known heading IDs remain preserved and reserved even when the title is unknown.

## Native wrappers and conditional derivation

Result schemas retain native Zod behavior. `.optional()` is **not** a body-presence policy or a zero-work guarantee: an inner transform can receive `undefined` and request body processing even when an outer wrapper returns `undefined` or suppresses its issues. Actual inner requests, not the final retained value, determine work. Defaults, unions, refinements, and custom schemas do not introduce a separate Velite scheduler.

To skip derivation for a missing or exactly empty selected body, explicitly preprocess to a `null` sentinel and let `.nullable()` stop the inner content schema:

```ts
import { content, context, s } from 'velite'

const article = content.markdown()
const optionalHtml = s
  .preprocess(value => {
    const selected = value === undefined ? context().file.content : value
    return selected === undefined || selected === '' ? null : selected
  }, article.html().nullable())
  .transform(value => value ?? undefined)
```

This example intentionally accepts `null` as its skip sentinel; that is this schema's explicit policy, not the default content-input contract. Other non-string inputs still fail, and whitespace-only strings still process. The preprocessing callback runs inside the active record context.

## Failure dependencies and recovery

| Failed work                             | Affected selections | Earlier successful values still available |
| --------------------------------------- | ------------------- | ----------------------------------------- |
| Parse                                   | All selections      | None from the failed stage                |
| Complete Transform, including MDX recma | TOC and HTML/code   | Source excerpt and metadata               |
| Serialization or minification           | HTML/code           | Source Analysis and TOC                   |

Use ordinary `.catch()` to recover field-local content/plugin validation issues:

```ts
const article = content.markdown()
const schema = s.object({
  html: article.html().catch(''),
  excerpt: article.excerpt(),
  metadata: article.metadata()
})
```

A recovered Transform/Emit failure does not erase successful source results. Failed stages are memoized, not retried by another selection or fallback; a fresh actual record validation starts a fresh execution. `.catch()` does not swallow directly thrown internal invariants, recursive pending requests, or lifecycle faults. Every dependent requesting field receives its own ordinary issue path, while shared warnings belong to the record/execution rather than the first field to request work.

## Detached values and controlled effects

Every TOC delivery has a fresh detached array and item objects; metadata objects are detached too. A consumer's `.transform()` can mutate its own result without changing another field's result or the internal snapshots. Custom schemas can compose these result schemas as black boxes, without shared AST, VFile, cache, or lifecycle access.

Velite-owned effect declarations are buffered by stage. A failed stage discards its declarations; a successful stage makes them eligible once per execution, regardless of the number or order of consumers. Eligibility is **not commitment**: invalid records discard all sibling effects, and valid candidates still pass cross-record validation and build-publication gates. Recovery can preserve successful lower-stage effects, never failed-stage effects. A wrapper discarding a result does not undo work already requested.

Direct plugin filesystem, network, and other external I/O cannot be rolled back. Source-only requests skip returned transformers and emission, but plugin initialization can still run attachers. TOC-only processing runs transformations and asset resolution even though it skips serialization/minification. Record completion closes the execution; captured capabilities are not usable later.

Built-in linked-asset processing checks the active record, schema lease and stage before starting controlled asset work. After terminal close it cannot start another asset demand, read or probe. An I/O operation already started while active may still settle; its late result cannot promote a declaration. This is a terminal fence, not cancellation of already-started I/O or revocation of independently retained plugin references.
