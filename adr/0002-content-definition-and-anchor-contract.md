# Content Definition and Heading Anchor contract

Status: accepted implementation contract for Velite 1.0, 2026-10-01. The user approved the `content.markdown` / `content.mdx` API baseline and Unicode anchor baseline; this decision completes their concrete types, options, and value rules. It does not claim these exports or methods exist in the current runtime, or approve an intermediate implementation for release.

[ADR 0001](0001-share-semantic-content-results.md) chooses exclusively owned content executions and detached semantic results. This decision fixes the public contract that implements that architecture, rather than approving the earlier hybrid schema roots or profile-equivalence broker. Domain terms come from [`CONTEXT.md`](../CONTEXT.md); the unchanged [parent spec](../.agents/issues/1.0-semantic-content-execution/spec.md) remains the implementation scope. Read this decision before implementing or reviewing content APIs, input selection, source values, or heading navigation.

## Public API (target, not an implemented example)

The root package exports the runtime value `content`, with exactly two definition factories. It exports the types below; factories are namespace members, not additional root-level `markdown` / `mdx` exports or members of `s`.

```ts
import type { PluggableList } from 'unified'
import type { ZodType } from 'zod'

export interface ContentNamespace {
  readonly markdown: (options?: MarkdownDefinitionOptions) => MarkdownDefinition
  readonly mdx: (options?: MdxDefinitionOptions) => MdxDefinition
}

export declare const content: ContentNamespace

export interface MarkdownDefinitionOptions {
  gfm?: boolean
  removeComments?: boolean
  copyLinkedFiles?: boolean
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

export interface MdxDefinitionOptions extends MarkdownDefinitionOptions {
  minify?: boolean
  outputFormat?: 'program' | 'function-body'
  development?: boolean
  recmaPlugins?: PluggableList
}

export interface MarkdownDefinition {
  html(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}

export interface MdxDefinition {
  code(): ZodType<string, string | undefined>
  toc(): ZodType<TocItem[], string | undefined>
  excerpt(options?: ExcerptSchemaOptions): ZodType<string, string | undefined>
  metadata(): ZodType<Metadata, string | undefined>
}

export interface ExcerptSchemaOptions {
  length?: number
}

export interface TocItem {
  depth: number
  title: string
  id: string
}

export interface Metadata {
  readingTime: number
  wordCount: number
}
```

- A Content Definition is configuration plus opaque identity, **not a Zod schema**. It has no `parse`, `optional`, `transform`, `project`, or lifecycle method. Each finite result factory returns an ordinary async Zod schema: `z.input` is `string | undefined`, and `z.output` is exactly the declared result type before native wrappers change it. Existing `Schema` / `Infer` collection support remains applicable. There is no aggregate `ContentResult` export or second schema protocol.
- Methods capture their definition without requiring a `this` binding. Aliasing a definition or extracting a method preserves its identity. Each call constructs a result schema; constructing a definition or result schema starts no processor work.
- `TocItem`, `Metadata`, and `ExcerptSchemaOptions` retain their existing public names. `TocItem.id` replaces `slug`; no alias field survives. `MarkdownDefinition` / `MdxDefinition` and their option types replace `MarkdownRoot` / `MdxRoot` and `MarkdownSchemaOptions` / `MdxSchemaOptions`, not compatibility aliases.
- Keep `s` for ordinary Zod and other built-ins. The completed migration removes `s.markdown`, `s.mdx`, standalone `s.toc` / `s.excerpt` / `s.metadata`, and any proposed `s.content` family. A definition has only the methods shown; Markdown has no `code`, MDX has no `html`, and `toc` / `metadata` take no options. Unsupported extra arguments in untyped JavaScript have no acceptance/ignore/rejection compatibility promise.
- `PluggableList` and `ZodType` here are dependency types, not new Velite root exports. No processor, AST, VFile, request descriptor, broker, seed, cache key, phase cursor, adapter registry, or general projection protocol enters the public contract.

Target composition:

```ts
import { content, s } from 'velite'

const article = content.markdown({ gfm: true })
const schema = s.object({
  html: article.html(),
  toc: article.toc(),
  excerpt: article.excerpt({ length: 160 }),
  metadata: article.metadata()
})
```

## Options and configuration ownership

These defaults and precedence preserve the pre-migration `src/core/schema/markdown.ts`, `src/core/schema/mdx.ts`, and dialect-processor behavior (removed by Ticket 11), not the abandoned historical global-before-local order:

| Option                           | Default           | Scope                                                                                                |
| -------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `gfm`                            | `true`            | Both dialects; parser syntax                                                                         |
| `removeComments`                 | `true`            | Both dialects; Markdown HTML comments or MDX expression block comments; preserve surrounding content |
| `copyLinkedFiles`                | `true`            | Both dialects; supported static local references are resolved/rewritten during Transform             |
| `remarkPlugins`, `rehypePlugins` | `[]`              | Both dialects; ordinary Unified registrations                                                        |
| `minify`                         | `true`            | MDX Emit only; Terser                                                                                |
| `outputFormat`                   | `'function-body'` | MDX; `'program'` is also supported                                                                   |
| `development`                    | `false`           | MDX processor configuration                                                                          |
| `recmaPlugins`                   | `[]`              | MDX complete Transform; ordinary recma registrations                                                 |

- Resolve each scalar as `definition option ?? current epoch's project.markdown/mdx option ?? default`. Omitted factory options mean `{}`. Explicit `false` overrides a global `true`.
- Within each user-plugin phase, register **definition-local entries first, global entries second**, preserving list order and passing registrations through ordinary Unified `.use()` semantics. Velite does not sort, deduplicate, or structurally compare registrations. Unified may merge repeated plugin registrations according to its native behavior; duplicate list entries are not a promise of duplicate transformer invocations.
- Built-in GFM/comment setup precedes user remark registrations. Preserve Markdown raw-HTML conversion before user rehype transformations, Markdown linked-file rewriting after user rehype plugins, and MDX linked-file rewriting after user remark plugins. Controlled anchor assignment/capture runs after all user remark/rehype content transforms, at the end of the dialect's content-tree phase; in MDX it precedes conversion to JavaScript. Subsequent recma is still part of complete Transform.
- `recmaPlugins` is the one option completion required by the spec's ordinary recma processing and late-recma-failure tests. It is supported in the **target** MDX definition and global `mdx` defaults; at decision time `MdxSchemaOptions` / `MdxOptions` and processor wiring did not yet expose it (since implemented in `src/core/content/options.ts`). This is not wholesale `@mdx-js/mdx` option passthrough. Other existing option spellings/defaults remain unchanged.
- Existing public `MarkdownOptions` / `MdxOptions` describe the corresponding project defaults for these supported fields. Adapter inputs such as `processAsset`, `file`, `path`, and `mdast` are internal wiring, not definition options or public processing hooks.
- A definition captures its supported scalar values and ordered registration containers at construction. One record-local resolution snapshots effective options from that descriptor and the current configuration epoch before execution starts. Repeated selections, including different selected inputs on that definition, use that resolution. Config reload resolves against the replacement epoch; a definition never retains a previous record's execution.
- Snapshot ownership does not mean recursively cloning or freezing plugin functions, arguments, or private state. Callers treat configuration/registration values as immutable after establishment; external mutation is unsupported. Use configuration reload to change them. Plugin arguments retain ordinary reference/closure semantics, including opaque values.
- Processing options belong to the definition. Only `excerpt({ length })` is selection-specific and does not change execution identity. There is no `original`, TOC passthrough, metadata tuning, body-presence policy, cache control, or hidden dialect selection.

## Identity, input, and native Zod composition

Sharing identity is **one actual record-validation attempt + the same definition object + exact selected primitive string** (ECMAScript code-unit equality). Separate factory calls remain independent even with the same options and plugin references; different selected strings remain independent even under one definition. Equal explicit/fallback text shares under one definition. Neither Unicode normalization, hashing, structural profiles, plugin identity, nor filename extension substitutes for this identity.

The record scope supplies canonical source identity/path and initial source context. A plugin's legal VFile path change or replacement affects normal processing, not ownership or identity. A new record, actual revalidation, independent build, or configuration epoch never reuses an old execution. Existing outer validation memoization can still avoid a new validation attempt.

| Received schema input / selected text                                    | Required behavior                                                                                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Primitive string                                                         | Select that string; ignore file-body fallback                                                                                     |
| `undefined` / absent field                                               | Select `context().file.content`                                                                                                   |
| `null`, number, boolean, object, boxed string, or other non-string input | Normal field-local Zod input issue; no fallback and no content demand                                                             |
| Selected text missing or exactly `''`                                    | Non-fatal custom issue `The content is empty` at the requesting field; no demand, initialization, parse, or later processing      |
| Whitespace-only non-empty string                                         | Valid processing input; normal dialect processing                                                                                 |
| Non-empty source with no static visible text                             | Source excerpt `''`, metadata `{ readingTime: 1, wordCount: 0 }`; navigation depends on transformed content, not source emptiness |

No implementation placeholder is a successful value. An empty-input issue invalidates the field unless ordinary Zod composition recovers it.

Each selection works without a generated-content sibling and chooses its own input. Native transforms, refinements, pipes, unions, optionality, defaults, preprocessing, inference, and async parsing remain Zod behavior. `.optional()` is neither a selected-body-presence rule nor a zero-work promise: an inner request can run even when a wrapper discards its value/issues. `.catch()` recovers ordinary issues without retrying content stages or swallowing directly thrown internal faults. Conditional derivation uses explicit ordinary preprocessing/input composition, not wrapper inspection or a schema scheduler. Custom schemas may compose these result schemas as black boxes; their own processing gains no AST sharing or private capability.

## Execution and delivery boundaries

| Demand    | Work                                                                      | Successful semantic selection             |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| Parse     | Initialize/freeze, parse once, capture bounded pre-transform source text  | Excerpt, metadata                         |
| Transform | Continue the same ordinary run completely, capture provisional navigation | TOC, only after the complete run succeeds |
| Emit      | Continue serialization and configured minification                        | HTML or MDX code string                   |

- A stage shares its in-flight and completed success/rejection under the identity above. Higher demands continue the same owned processor/tree/file; they do not replay lower stages. Source-only initialization can run attachers, but not returned transformers or compilers. TOC-only runs content transforms and MDX code-tree construction/**recma**, but not serialization or minification; it can perform plugin I/O and asset resolution.
- Source text is captured before mutation/replacement; navigation is captured while the transformed content tree exists, but withheld until complete Transform succeeds. A late recma rejection invalidates both TOC and code, even if navigation was captured earlier. A later Emit failure affects generated content only. Successful earlier Source Analysis, or navigation after an Emit failure, remains available; failed stages are not retried.
- Follow ordinary callback-provided replacement trees/files and final compiler `value`, `result`, and messages. Keep opaque plugin state owned by the execution; never reconstruct it through a pristine tree/seed copy. Later code plugins must preserve captured heading/anchor semantics.
- Deliver fresh detached TOC arrays/items and metadata objects for every consumer. Primitive strings need no wrapper. Consumer mutation cannot alter another delivery or the internal source/navigation snapshots.
- Stage failures discard their Velite-owned declarations. Successful stages make declarations eligible once per execution, with execution/stage provenance rather than a first consumer's field. Captured public capability closures resolve the active stage at invocation, including async callbacks; they must not bind permanently to Parse or use a process-global stage pointer. Eligibility is not commitment: invalid records discard all sibling effects, and valid candidates still pass existing cross-record/build gates. Recovery preserves eligible successful lower-stage effects, not failed-stage effects. Direct plugin filesystem/network I/O cannot be rolled back.
- Ordinary content/plugin failures become issues on every dependent requesting field; shared warnings belong to the record/execution, not the first requester. There is no hidden duplicate fatal diagnostic defeating `.catch()`. Invariants, recursive self/ancestor pending demands, and late use remain directly thrown `VeliteError('internal')` faults. Do not fabricate original-file coordinates for unmapped selected/transformed text.
- Record close is terminal and idempotent in validation's outer cleanup. Release owned continuations/snapshots/journals; pending settlement cannot restart stages, repopulate retained state, or promote declarations. Fulfilled promises retain semantic outcomes rather than obsolete raw trees/files. No process/cross-record cache, content Engine graph, `ContentFile` derived representation, or content `SessionStore` cache is introduced.

## Navigation TOC and static limits

`toc()` returns a flat array of `{ depth, title, id }` in **transformed document order**. `depth` is the recognized heading level 1–6, `title` is its complete normalized static text, and `id` is the actual output heading target (not a URL fragment with `#`, an encoded URL, or an independently calculated slug).

- Eligible nodes are HTML content-tree `h1`–`h6`, including Markdown headings after conversion and intrinsic lower-case MDX JSX `h1`–`h6`. User transformations may add/remove/rename/reorder headings or set IDs. Capture the resulting headings, not a pristine source outline. Unknown components such as `<Heading>` are not inferred to be headings.
- For a recognized heading, static text/inline-code descendants and fully static intrinsic JSX children contribute in document order. Join fragments with ASCII space, collapse ECMAScript whitespace runs (`/\s+/gu`) to one ASCII space, and trim. Expressions or unknown runtime components in its title make the complete title undetermined; do not publish a misleading partial title. Comments, names, and attributes contribute no title text. A fully determined empty title is omitted without a capability warning, although its missing anchor can still be allocated using `heading`.
- MDX literal quoted ID attributes are static. Expression-valued IDs (even literal-looking expressions such as `id={'x'}` or `id={null}`) and spread attributes are outside static target analysis. A spread-bearing JSX element's effective target is treated as dynamic, without inspecting spread contents or inferring their precedence. Preserve those attributes, generate no replacement ID on that element, and omit a recognized heading whose target cannot be determined.
- A recognized heading with an undetermined title or target is omitted with a capability-limitation warning **only if TOC is requested**, including a late TOC request after Transform/Emit. A dynamic title is not converted to the empty-base fallback. Preserve any legal known ID, and reserve it even when that heading has no navigable title. Unknown components alone do not cause heading warnings. No MDX expression, ESM, generated JavaScript, or component is executed to obtain these results.
- Generated missing anchors on statically eligible headings are part of Transform even when only generated content was requested; they do not depend on a TOC field winning a race. Runtime heading components replacing intrinsic headings must forward the supplied `id`. Recma/downstream code plugins must preserve captured heading order, titles, levels, and targets. The guarantee is about Build-time Content, not layout IDs, visibility, surrounding DOM, or arbitrary runtime components/spreads.

## Explicit IDs and conflicts

Use the [HTML `id` rules](https://html.spec.whatwg.org/multipage/dom.html#the-id-attribute): a specified ID is non-empty, has no **ASCII whitespace**, and is unique within the analyzed content. ASCII whitespace is exactly `U+0009`, `U+000A`, `U+000C`, `U+000D`, and `U+0020`; it is not JavaScript `\s`, all Unicode whitespace, or a CSS-identifier restriction.

At the controlled transformed-content point, interpret statically known ID values as follows:

| Static value                                                                                            | Behavior                                                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Absent property/attribute, `undefined`, or `null` property value                                        | Missing ID; allocate automatically on a heading with a fully known title, including an empty title |
| Primitive string with at least one code unit and no ASCII whitespace                                    | Preserve exactly; reserve it before any automatic allocation                                       |
| `''` or string containing ASCII whitespace                                                              | Invalid explicit ID; content-stage failure, not a missing value or a normalization opportunity     |
| Any other present static value, including number, boolean/bare JSX `id`, array, object, or boxed string | Invalid explicit ID; do not stringify or silently replace it                                       |
| Dynamic expression/spread                                                                               | Preserve; apply the static limitation above, not a guessed value or invalid-static-ID issue        |

`null` / `undefined` here are absent **property values in the transformed representation**, not an instruction to evaluate an MDX expression. Quoted `id="null"` is the legal literal ID `null`; `id=""` is invalid. Explicit values are not trimmed, case-folded, NFC-normalized, slugged, or URL-encoded. Digits, punctuation, combining marks, and non-ASCII whitespace are legal under this ID rule. For example, `"0"`, `"A:B"`, and `"a\u00A0b"` are legal; `"a b"`, `"a\tb"`, and `""` are invalid. `"a\u000Bb"` contains vertical tab, not HTML ASCII whitespace, and is legal under this rule. Consumers escape CSS selectors/encode URL fragments as needed.

Scan **all current content elements**, not only TOC headings, before allocating any automatic heading ID. Include forward IDs, non-heading elements, and statically literal JSX IDs; literal IDs on unknown components are conservatively reserved without assuming those components are headings or guarantee DOM forwarding. Dynamic effective targets are not statically reservable. Duplicate legal explicit IDs use exact case-sensitive string equality, including heading/non-heading duplicates; all conflicting declarations are content errors and no first/last winner is chosen. Canonically equivalent but code-unit-distinct explicit IDs remain distinct.

Invalid or duplicate explicit IDs reject complete Transform and its dependent TOC/generated-content demands through ordinary field-local content issues, not internal exceptions or an unconditional build-fatal side channel. Source-only demand need not run this check. Zod recovery and the record/build effect gates still apply. Preserve the original ID declarations for error attribution; never silently repair, suffix, or choose between them. Exact diagnostic wording is not a compatibility promise. Conflicts in surrounding/runtime-generated DOM remain outside static analysis.

## Automatic Heading Anchors

For a fully determined normalized heading title, compute the base independently of document reservations:

1. Apply ECMAScript `normalize('NFC')`, locale-independent `toLowerCase()`, then NFC again.
2. Iterate Unicode code points. Retain Unicode `Letter`, `Number`, or `Mark`, and exactly `_` (`U+005F`). Treat Unicode `White_Space` and `-` (`U+002D`) as pending separators. Remove other punctuation/symbols/emoji/controls without transliteration; removed characters do not clear a pending separator.
3. Emit one pending `-` only between retained content. There are no leading/trailing hyphens; whitespace/hyphen runs collapse; underscores are retained, not separators.
4. If no retained content remains, use `heading`.

Then visit missing-ID static headings in transformed document order. Choose the first unoccupied candidate `base`, `base-1`, `base-2`, … (positive decimal suffixes without leading zeros), considering the entire explicit reservation set and every previously allocated ID. Reserve the chosen value immediately and write that same ID to the output heading and TOC item. Legal explicit IDs bypass this base algorithm.

### Independently expected anchor fixtures

Quoted fixture strings use JavaScript escapes. These expectations are hand-derived from the algorithm, not current helpers or an ecosystem slugger.

| Title                    | Base                                                 |
| ------------------------ | ---------------------------------------------------- |
| `"Hello, WORLD!"`        | `"hello-world"`                                      |
| `"Crème 茶"`             | `"crème-茶"`                                         |
| `"Cafe\u0301"`           | `"café"`                                             |
| `"q\u0301"`              | `"q\u0301"` (uncomposed mark retained)               |
| `"İ"`                    | `"i\u0307"` (locale-independent lowercase expansion) |
| `"foo_bar--Baz"`         | `"foo_bar-baz"`                                      |
| `"  -- A - 💡 - B --  "` | `"a-b"`                                              |
| `"ab/cd"`                | `"abcd"`                                             |
| `"🔥"`, `"!!!"`, or `""` | `"heading"`                                          |

Every row below is a separate document. `auto` denotes a missing-ID heading; listed elements are in transformed order. All explicit IDs are reserved before the first `auto`.

| Current content                                                                    | Exact heading IDs / outcome                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `auto("Intro")`, later `<div id="intro">`, `auto("Intro")`                         | `intro-1`, `intro-2`; forward non-heading ID stays `intro`                                    |
| Three `auto("Repeat")` headings                                                    | `repeat`, `repeat-1`, `repeat-2`                                                              |
| Four `auto("Repeat")`; explicit non-heading IDs `repeat-1` and `repeat-3` anywhere | `repeat`, `repeat-2`, `repeat-4`, `repeat-5`                                                  |
| `auto("Hello-1")`, `auto("Hello")`, `auto("Hello")`                                | `hello-1`, `hello`, `hello-2`; an earlier automatic suffix-shaped base is occupied            |
| `auto("Intro")`, later heading `title="Different" id="intro"`                      | `intro-1`, `intro`; the second TOC item uses title `Different` and actual ID `intro`          |
| `auto("Cafe\u0301")`, `auto("Café")`, `auto("Crème 茶")`                           | `café`, `café-1`, `crème-茶`                                                                  |
| `auto("🔥")`, `auto("!!!")`; explicit non-heading ID `heading`                     | `heading-1`, `heading-2`; emoji/punctuation titles remain navigation items                    |
| Heading `id="same"`, later non-heading `id="same"`                                 | Explicit conflict; no successful TOC/generated result from that Transform; neither ID renamed |
| Non-heading `id="same"`, later non-heading `id="same"`                             | Same explicit conflict, even with no TOC heading                                              |
| Explicit IDs `Intro` and `intro`; `auto("Intro")`                                  | Explicit IDs preserved; automatic ID `intro-1`; comparison is case-sensitive                  |
| Explicit IDs `"é"` and `"e\u0301"`                                                 | Both preserved and distinct; explicit IDs are not NFC-normalized                              |

Automatic IDs depend on transformed titles, plugin output, document order, the reservation set, and the supported runtime's Unicode properties/case mappings. Inserting/removing duplicate headings or explicit targets can change later automatic IDs. **Legal unique explicit IDs** are the supported insertion-independent external-link contract; automatic duplicate suffixes are not stable permanent identifiers.

## Source Analysis value oracle

These rules inherit historical [Ticket 20](../.agents/issues/1.0-content-derivation-kernel/issues/20-finalize-the-built-in-projection-contract.md), sections “Static visible text,” “Excerpt,” and “Metadata.” They are normative here; its pristine/profile/root/source-TOC rules are not. Transitional helpers and pre-1.0 getters are not value oracles.

### Normalized static source text

From the selected dialect-correct Source Content, before returned transformers run, collect in source order ordinary text, static inline-code text, and statically known text children nested in JSX (including components). Exclude expressions, ESM, element/component names, attributes, comments, and any text requiring JavaScript/component evaluation. Join fragments with **one ASCII space**, collapse ECMAScript whitespace runs (`/\s+/gu`) to one ASCII space, and trim both ends. Source Analysis may collect known children even when a complete runtime heading title cannot be established for navigation. It does not count raw syntax or transformed output.

Capture enough bounded text before transformation to serve any later finite Source Analysis selection. Retain no second source AST. Different excerpt lengths do not reopen parsing. Non-empty selected source without visible text produces normalized text `''`, distinct from empty selected input.

### Excerpt

- `length` defaults to `260` when the options object or property is omitted/`undefined`. An explicitly supplied value must satisfy `typeof length === 'number' && Number.isSafeInteger(length) && length >= 0`; every other value synchronously throws `TypeError` at result-schema construction. This includes negative/fractional/non-finite numbers, bigint, string, `null`, and boxed numbers. Exact error text is not public behavior.
- Iterate normalized source text by ECMAScript string iteration (Unicode code points). If its length is at most `length`, return it unchanged. Otherwise take the first `length` code points, apply `trimEnd()`, and append exactly `U+2026` (`…`) **outside** the requested length. No word-boundary search; never split a valid surrogate pair; splitting grapheme clusters/combining sequences is permitted.

```text
text = "abc", length = 4  => "abc"
text = "abc", length = 3  => "abc"
text = "abc", length = 2  => "ab…"
text = "a b", length = 2  => "a…"
text = "A😀B", length = 2 => "A😀…"
text = "abc", length = 0  => "…"
text = "", length = 0     => ""
```

### Metadata

Count all normalized source text, never a truncated excerpt. A Latin word is one complete match of this exact ECMAScript Unicode Sets (`v`) regex:

```js
;/(?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+(?:['’](?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+)*/gv
```

Upper/lowercase and non-ASCII Latin letters participate; combining marks immediately following each Latin letter stay in that word. Only ASCII `'` (`U+0027`) and curly `’` (`U+2019`) connect **two non-empty Latin runs**. Leading, trailing, and repeated apostrophes are not connectors; valid runs on either side remain separate matches. CJK characters separate Latin matches (`a中b` is two Latin words and one CJK character).

The complete **frozen 1.0** CJK table is below, in hexadecimal Unicode code points. Intervals are half-open `[start, end)`, including start and excluding end. Do not replace or expand this table from newer Unicode data.

```text
Han:
[2E80,2E9A) [2E9B,2EF4) [2F00,2FD6) [3005,3006)
[3007,3008) [3021,302A) [3038,303C) [3400,4DB6)
[4E00,9FEB) [F900,FA6E) [FA70,FADA) [20000,2A6D7)
[2A700,2B735) [2B740,2B81E) [2B820,2CEA2)
[2CEB0,2EBE1) [2F800,2FA1E)

Hiragana:
[3041,3097) [309D,30A0) [1B001,1B11F) [1F200,1F201)

Katakana:
[30A1,30FB) [30FD,3100) [31F0,3200) [32D0,32FF)
[3300,3358) [FF66,FF70) [FF71,FF9E) [1B000,1B001)
```

Iterate text by ECMAScript code points and count each point contained in any listed interval once. Supplementary characters count once per valid surrogate pair; an unpaired surrogate matches neither Latin nor CJK. Let `latinCount` be the complete regex match count and `cjkCount` this interval count. Use JavaScript `number` arithmetic exactly:

```text
wordCount = latinCount + cjkCount * 0.56
readingTime = Math.max(1, Math.round(wordCount / 265))
```

Do not round or decimal-normalize `wordCount`; ordinary IEEE-754 representation is observable. `Math.round` is ECMAScript rounding (a mathematical half toward positive infinity). Zero counted text yields `{ readingTime: 1, wordCount: 0 }`. For example, `a中b` has `wordCount = 2.56`, `readingTime = 1`; `can't l’été` has two Latin words; `a''b` also has two. Tests implement the regex, table, iteration, multiplier/divisor, and rounding independently rather than importing candidate helpers.

## Architecture guidance and scoped supersession

Active implementation guidance is [module architecture](../.agents/knowledge/module-architecture.md), [schema context](../.agents/knowledge/schema-context.md), and [error handling](../.agents/knowledge/error-handling.md). Factory DI and explicit pipeline/validate assembly remain mandatory for state/dependency/lifecycle owners. Preserve the process-owned ambient host, distinct public/private runtime objects, and exactly eight public fields: `project`, `file`, `record`, `store`, `collectEffect`, `asset`, `readFile`, `probeImage`. Neither the host nor the public context owns a content cache, execution, journal, Builder, or registry.

Historical content decisions carry scoped notices pointing here and to ADR 0001. Their original reasoning remains history. This replaces profile-equivalence sharing, hybrid roots, pristine/seed copying, independent transform branches, source-only TOC, equal/empty slug targets, global-before-local order, cloneability restrictions, and old content-only migration/performance gates. Source-text/excerpt/metadata values above and necessary record/cross-record/build transaction obligations survive. **Unrelated generation, publication, prepare, cleanup, reader, and Builder decisions are neither superseded nor reapproved here**; the new spec does not adopt their broader release/evidence infrastructure as a prerequisite.

## Bounded implementation migration and acceptance

Working new selections may temporarily coexist with existing callers **only on the implementation branch, through Ticket 11** of the semantic-content tracker. Add small working end-to-end slices; expose a runtime method only once its slice works. This ADR's target declarations are not permission to publish empty successes, throwing stubs, or placeholder methods. Ticket 11 migrates consumers and removes the entire old public/internal content path, types, obsolete tests, and conflicting product docs. No permanent compatibility aliases, alternate API family, retained seed path, or intermediate 1.0 release is promised.

Concrete contract approval is distinct from production verification. Subsequent tickets must prove packaged runtime/types, independently expected values and actual targets, ordinary plugin continuation/replacements, stage failures/effects, native Zod recovery, detached delivery, recursive-demand guards, terminal close, isolation, and representative cost/retention. Documentation checks or an independent fixture calculator do not substitute for those production tests or release acceptance.
