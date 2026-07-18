# Finalize the built-in projection contract

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 03, 04, 07, 19

---

## Question

What is the complete 1.0 built-in projection surface and edge-case contract, including whether `metadata()` is a Markdown/MDX root method, its selected-input and static-text semantics, the supported TOC options, and the result when neither an explicit value nor file-body fallback exists?

## Review context

Migration guidance introduced root `metadata()` without defining its artifact, dialect, plugin, identity, correctness, or performance contract. It also deferred the documented TOC `original` option to implementation. Content Input requires selected text while public `ContentFile.content` remains optional. Resolve these as public semantics rather than implementation choices, and remove the superseded custom `.project()` reservation from the effective 1.0 contract.

## Answer

### Decision

The complete Velite 1.0 built-in derivation family consists of the primary Markdown or MDX schema plus exactly three sibling projection methods:

```ts
interface MarkdownRoot extends Schema<string> {
  toc(): Schema<TocItem[]>
  excerpt(options?: ExcerptSchemaOptions): Schema<string>
  metadata(): Schema<Metadata>
}

interface MdxRoot extends Schema<string> {
  toc(): Schema<TocItem[]>
  excerpt(options?: ExcerptSchemaOptions): Schema<string>
  metadata(): Schema<Metadata>
}

interface ExcerptSchemaOptions {
  length?: number
}

interface Metadata {
  readingTime: number
  wordCount: number
}
```

`s.markdown(options)` and `s.mdx(options)` return these roots directly. Ordinary Zod wrappers are not required to preserve the methods. The top-level `s.toc()`, `s.excerpt()`, and `s.metadata()` forms are removed. There is no public `.project()` method, reserved name, recipe interface, or generic custom projection protocol in 1.0.

The root and each sibling remain independent schemas. Each selects and validates its own input, can run without the primary sibling, and does not depend on sibling values, object-key order, root object identity, or schema completion order.

### Selected input and empty content

Every primary root and built-in sibling applies the same selection rule:

```text
selected text = explicit string input ?? ContentFile.content
```

An explicit string always wins, including `''`. The file body is consulted only when the schema input is absent. After selection, explicit input and file-body fallback have identical dialect-aware parse and projection semantics. Neither source receives a raw-string shortcut or a Markdown-only derived getter.

If the selected text is missing or exactly `''`, the schema adds a non-fatal Zod custom issue with message `The content is empty` at that field's normal Zod path. The record is invalid. The schema must return its implementation placeholder only as required by Zod control flow; no placeholder is a successful public value. Crucially, this case must not open or call the content capability, install a parse slot, invoke a parser, or run a projection.

Whitespace-only text is not empty under this rule and is parsed normally. A non-empty source that has no statically visible text is also not reclassified as missing input. Its successful static results are:

- metadata: `{ readingTime: 1, wordCount: 0 }`;
- excerpt: `''`;
- TOC: `[]`.

This distinction supplies an executable no-parse oracle without requiring a parse to decide whether the source is semantically empty. Optional `ContentFile.content` therefore remains coherent: absent fallback is a field-local schema issue, not an internal exception or a successful zero value.

### Static visible text

Excerpt and metadata use the same dialect-correct **static visible text** semantics over the pristine Markdown or MDX representation. They collect, in source order:

- ordinary text;
- static inline-code text; and
- statically known text children nested inside JSX.

They exclude MDX expressions, ESM, JSX element/component names, JSX attributes, comments, and every value that would require JavaScript or component evaluation. Collected text fragments are joined with one ASCII space, every whitespace run is collapsed to one ASCII space, and leading and trailing whitespace is removed. This is the isolated semantic oracle for both dialects.

Excerpt applies the normative code-point truncation algorithm below. Metadata consumes the complete normalized text without truncation. Neither projection observes mutations from a primary render/compile branch.

### Final projection value oracle

This section is the complete normative 1.0 value oracle for excerpt truncation, TOC slugs, and metadata counting. It supersedes every earlier clause that left one of these values to implementation, described a length merely as "characters," referred to an unspecified established regex or range table, or implicitly treated a pre-1.0 helper as the oracle.

#### Excerpt

`ExcerptSchemaOptions` remains exactly:

```ts
interface ExcerptSchemaOptions {
  length?: number
}
```

The default `length` is `260`, including when the options object or its `length` property is omitted or `undefined`. The unit is Unicode code points, not JavaScript UTF-16 code units, bytes, grapheme clusters, words, or display columns.

At schema construction, an explicitly supplied `length` must satisfy `typeof length === 'number' && Number.isSafeInteger(length) && length >= 0`. JavaScript calls supplying a negative number, fractional number, `NaN`, either infinity, a bigint, string, `null`, boxed number, or any other non-number synchronously throw `TypeError`. This is invalid schema configuration, not a record-local Zod issue. TypeScript continues to reject non-number inputs through `length?: number`; the runtime check defines untyped JavaScript and non-finite-number behavior. No exact error-message text is public compatibility behavior.

Given normalized static visible text `text` and a validated `length`:

1. Iterate `text` by ECMAScript string iteration, which yields Unicode code points and keeps a valid surrogate pair together.
2. If the number of code points is less than or equal to `length`, return `text` byte-for-byte.
3. Otherwise join the first `length` code points, apply ECMAScript `String.prototype.trimEnd()`, and append exactly `U+2026 HORIZONTAL ELLIPSIS` (`…`).

The ellipsis does not count toward `length`. A non-empty visible text truncated at `length = 0` therefore returns `…`. The algorithm never splits a valid surrogate pair, but it may split an extended grapheme cluster or a base-plus-combining-mark sequence. It performs no word-boundary search. Normalization has already collapsed whitespace, so `trimEnd()` matters when the cut falls immediately after the normalized ASCII space between fragments or words.

The exact boundary fixtures include:

```text
text = "abc", length = 4  => "abc"
text = "abc", length = 3  => "abc"
text = "abc", length = 2  => "ab…"
text = "a b", length = 2  => "a…"
text = "A😀B", length = 2 => "A😀…"
text = "abc", length = 0  => "…"
text = "", length = 0     => ""
```

The last fixture is the successful result for a non-empty selected source with no static visible text. It is distinct from a missing or exactly empty selected input, which produces `The content is empty`, performs zero parse/projection work, and has no successful value. Markdown and MDX, and explicit input and file-body fallback, use this same algorithm after the already-defined selection and dialect-aware static-text steps.

#### TOC slug

Velite owns the slug algorithm. It does not call, expose, or inherit behavior from an external slugger, `mdast-util-toc`, GitHub slugging, locale-sensitive case mapping, or an ecosystem package version.

For each non-empty static heading title:

1. Apply ECMAScript `String.prototype.normalize('NFC')`.
2. Apply locale-independent ECMAScript `String.prototype.toLowerCase()`, then normalize to NFC again.
3. Iterate by Unicode code point. Preserve a code point if it has Unicode general category `Letter`, `Number`, or `Mark`, or if it is exactly `U+005F LOW LINE` (`_`). Treat a maximal sequence consisting of Unicode `White_Space` code points and/or `U+002D HYPHEN-MINUS` (`-`) as one pending separator. Emit that separator as one `-` only between preserved content. Remove every other punctuation, symbol, emoji, control, and unclassified code point without replacing it.
4. Return the result. The pending-separator rule means there is no leading or trailing `-` and whitespace/hyphen runs collapse to one `-`. Underscores are preserved and are not separators. There is no transliteration.

Unicode properties and case conversion use the ECMAScript semantics of Velite's supported JavaScript runtime. NFC makes canonically equivalent composed/decomposed titles stable under that runtime. Combining marks are retained, including a mark that cannot be composed; emoji are removed. A heading with a non-empty static title remains in the TOC even if removal yields `slug: ''`. A heading with no static title, including an expression-only heading, remains omitted under the earlier title rule. Static JSX heading text participates exactly like other static title text.

Slug generation is pure per heading. Duplicate headings retain the same slug; Velite does not append `-1`, `-2`, or any other uniqueness suffix. TOC items remain in source order, but source order does not alter a heading's slug.

The exact fixtures include:

```text
"Hello, WORLD!" => "hello-world"
"Crème 茶"      => "crème-茶"
"Cafe\u0301"   => "café"
"foo_bar--Baz" => "foo_bar-baz"
"🔥"           => ""
"Repeat"       => "repeat"
"Repeat"       => "repeat"
```

#### Metadata

Metadata counts the complete normalized static visible text. It never counts raw Markdown/MDX source syntax, HTML/JSX names or attributes, expressions, ESM, comments, renderer output, or truncated excerpt text.

A Latin word is one complete match of this ECMAScript Unicode Sets (`v`) regular expression:

```js
;/(?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+(?:['’](?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+)*/gv
```

The pattern is case-independent because it accepts uppercase and lowercase Latin-script letters directly. It includes non-ASCII Latin letters. Any Unicode combining marks immediately following a Latin letter remain in that word. Exactly `U+0027 APOSTROPHE` (`'`) and `U+2019 RIGHT SINGLE QUOTATION MARK` (`’`) may join two non-empty Latin-letter runs. Leading, trailing, or repeated apostrophes are not connectors; valid Latin runs around an invalid connector sequence are separate regex matches.

The CJK table below is frozen 1.0 data. Every interval is a Unicode code-point half-open interval `[start, end)`: the start is included and the end is excluded.

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

Iterate the complete text with ECMAScript string iteration. A supplementary-plane code point represented by a valid surrogate pair is visited and counted once. An unpaired surrogate is one unmatched code point and contributes neither a Latin word nor a CJK character. Let `latinCount` be the number of complete regex matches and `cjkCount` the number of iterated code points contained in any listed interval. CJK code points remain separators for Latin matching; for example, `a中b` has two Latin words and one CJK character.

The result is calculated with JavaScript `number` operations exactly as follows, with no decimal normalization or rounding of `wordCount`:

```text
wordCount = latinCount + cjkCount * 0.56
readingTime = Math.max(1, Math.round(wordCount / 265))
```

`wordCount` is therefore non-negative and may expose ordinary IEEE-754 fractional representation. `Math.round` has ECMAScript semantics; a mathematical half rounds toward positive infinity. A non-empty selected source with no visible Latin words or listed CJK code points returns `{ readingTime: 1, wordCount: 0 }`.

The independent oracle must implement the regex, frozen intervals, code-point iteration, `0.56` multiplier, `265` divisor, and ECMAScript rounding directly. It must not call the candidate projection, a pre-1.0 metadata getter, the old `ContentFile.plain`, or a candidate-private helper.

### Metadata contract

`metadata()` is a dialect-rooted static projection with no metadata-specific options in 1.0. It returns the existing public `Metadata` shape and applies the exact Latin pattern, frozen half-open Unicode ranges, code-point iteration, weighting, and JavaScript arithmetic in the final projection value oracle above. Those rules are correctness behavior, not configurable inputs, for 1.0.

Metadata inherits the root's dialect and complete effective parse profile. Parser setup and parser syntax extensions in that profile participate in constructing the pristine representation. Remark, rehype, and recma transformers do not run for metadata; MDX JavaScript, ESM, JSX components, rendering, compilation, and minification are never executed.

The metadata request kind is part of internal projection-request identity. The selected text, path/origin, dialect, and effective parse profile are part of parse identity under the existing broker contract. There are no metadata options to add to parse identity. If projection options are added in a future version, they belong to projection-request identity unless they actually change parsing.

Static visible text is a semantic artifact name, not a new public representation or a mandatory cache. The implementation may traverse a matching pristine representation separately for excerpt and metadata. It must not add a second cross-record, `ContentFile`, `SessionStore`, or process cache, and 1.0 promises only matching pristine-parse sharing, not metadata-result or visible-text-result memoization.

### TOC contract

The final method is exactly `toc(): Schema<TocItem[]>`. There is no `TocOptions` type and no supported argument. In JavaScript, passing an argument is outside the supported interface and receives no compatibility guarantee; callers must not rely on arguments being accepted, ignored, or rejected.

The documented but unimplemented `original` option is deleted from the 1.0 type, documentation, migration target, and runtime contract. Velite does not expose the options of `mdast-util-toc` through this method.

TOC remains a flat source-ordered array of `{ depth, title, slug }`. It collects Markdown heading nodes from the dialect-correct pristine representation. Heading titles use the static-visible-descendant rules already established for TOC: literal text, inline code, and static JSX text children contribute; expressions, ESM, JSX names, and JSX attributes do not. A heading with no static title is omitted. No transformer, renderer, compiler, component, or JavaScript expression runs.

Each retained heading receives the exact Velite-owned Unicode slug specified in the final projection value oracle above. Slugs are independently derived per heading, may be empty, and are not made unique when titles repeat.

### Internal interface and lifecycle

Built-in roots and projections use only the private record-bound `content(request)` capability selected by the internal `SchemaRunContext` decision. Their controlled descriptors carry selected text, source path/origin, dialect, effective profile, projection kind, projection options where applicable, and stable request provenance. They do not expose or retain a broker, AST, VFile, parser, cache key, generic demand operation, or lifecycle method.

Roots retain only immutable configuration/profile descriptors across records and config epochs. A projection request and every pristine artifact remain record-scoped and are released with the record broker. This ticket adds no process-wide state, singleton, service locator, `SessionStore` cache, cross-record cache, or new factory dependency. Config reload replaces roots/profile descriptors with the pipeline epoch under the existing lifecycle decisions; it does not alter these public projection semantics.

### Error and failure behavior

- Missing or exactly empty selected text produces the field-local Zod issue above and performs zero parse work.
- Parse or static-projection content failures are associated with every demanding field under the existing branch-outcome and diagnostic contract; a shared root cause does not erase field paths.
- Static projections produce no asset or unique effects and cannot observe or publish effects from a failed primary sibling.
- An invalid record commits no effects under the record-atomic effect decision.
- Plugin exceptions and malformed content follow the existing schema diagnostic severity and publication rules; this ticket does not introduce a parallel thrown-error type.
- Unsupported JavaScript arguments to `toc()` are not a defined runtime error channel and are not part of compatibility behavior.

### Alternatives rejected

1. **Remove metadata and require a custom black-box schema.** This avoids one root method but forces common reading metadata to choose and own a dialect parser, repeats parsing, and cannot share the root's exact MDX-aware profile. The finite built-in projection is justified by current public usage and has a much smaller interface than a generic recipe protocol.
2. **Keep top-level projection schemas.** Top-level `s.toc()`, `s.excerpt()`, or `s.metadata()` would need hidden dialect/profile inference and could silently parse MDX as Markdown. Root methods make the required context explicit and preserve independent projection-only use.
3. **Expose metadata tuning options.** Public words-per-minute, CJK weighting, tokenization, or text-extraction options would stabilize unproven configuration and enlarge request identity. The current fixed algorithm gives one migration-compatible oracle; future evidenced options can be additive.
4. **Count raw selected source for metadata.** This would count Markdown syntax, MDX code, JSX names/attributes, and ESM, while fallback through the old `file.plain` path would behave differently. One dialect-aware static-text path is more correct and makes explicit/fallback equivalence testable.
5. **Treat whitespace-only or no-visible-text source as missing.** That would require parsing before satisfying the promised no-parse empty-input path and would conflate source absence with a valid static projection whose result is empty.
6. **Support `toc({ original: true })` or all `mdast-util-toc` options.** The current output is a derived flat array, not a rewritten document with an original TOC to preserve. No implementation or user requirement supports the option, and importing an upstream options surface would make unrelated behavior part of Velite's interface.
7. **Cache normalized visible text as another public or long-lived artifact.** It is not needed to guarantee the measured parse reduction and would duplicate broker/cache ownership. A future internal optimization remains possible if it preserves record lifetime and isolated equivalence.
8. **Use UTF-16 `slice()` or omit the ellipsis for excerpts.** Direct slicing is smaller but can emit a lone surrogate, while no ellipsis makes a truncated value indistinguishable from complete text. Code-point truncation plus one exact suffix is deterministic without introducing grapheme segmentation.
9. **Delegate TOC slugs to an external unique slugger.** GitHub-style uniqueness is useful for generated anchor IDs but would add package/version state and make earlier headings alter later values. TOC promises a title-derived slug, not anchor allocation, so the fixed per-heading Unicode algorithm keeps the interface smaller.
10. **Retain the pre-1.0 ASCII metadata regex or use `Intl.Segmenter`.** The former excludes ordinary non-ASCII Latin words and curly apostrophes; the latter adds locale and runtime segmentation policy. The fixed regex and range table are independently calculable and preserve the selected weighting model.

### Superseded clauses

- Issue 04's statement that the root reserves `content.project(...)` is superseded. Issue 07 rejected the protocol; this decision removes the reservation from the effective built-in root contract and leaves no reserved method name.
- Any migration or documentation text retaining top-level `s.metadata()`, `s.toc()`, `s.excerpt()`, `TocOptions`, or `options.original` is superseded for the 1.0 target.
- Current implementation behavior in which metadata fallback reads Markdown-only `ContentFile.plain`, explicit metadata counts a raw string, or TOC reads a file-body `ContentFile.mdast` despite explicit input is a known pre-1.0 behavior, not an equivalence oracle.
- The earlier phrase “Excerpt truncates ... according to `length`” is superseded by the default-260, non-negative-safe-integer, Unicode-code-point, `trimEnd() + U+2026` algorithm above. The pre-1.0 direct UTF-16 `slice()` behavior, its no-ellipsis result, and the unrelated helper default of `200` are not 1.0 semantics.
- The earlier “established apostrophe-aware word rule” and “established Unicode ranges” placeholders are superseded by the exact `v`-flag Latin regex and frozen half-open table above.
- The pre-1.0 ASCII-oriented `\w` slug helper and any undeclared ecosystem duplicate-heading convention are superseded by the Velite-owned Unicode algorithm. Duplicate headings deliberately retain equal slugs.

### Migration consequences

- Rewrite top-level `s.metadata()` as `s.markdown().metadata()` or `s.mdx().metadata()` according to the source dialect. Prefer a named root when primary content and several projections share non-default profile options.
- Rewrite top-level TOC and excerpt schemas to the corresponding root methods. Do not offer a compatibility shim that guesses dialect.
- Remove documented `original` usage rather than translating it. A caller that needs document TOC rewriting must implement that behavior outside this finite projection contract.
- Do not advertise `.project()` or a replacement custom recipe helper. Custom schemas remain ordinary black boxes and own any parser or text extraction they require.
- Metadata values can change where raw Markdown/MDX syntax, expressions, JSX attributes, or ESM were previously counted, and explicit/fallback inputs now intentionally produce equal values for equal selected text/profile.
- Excerpts can change because 1.0 uses a default of `260`, counts Unicode code points, trims a truncated trailing whitespace fragment, and appends `U+2026` outside the requested length. Invalid runtime length configuration now fails synchronously instead of inheriting `String.prototype.slice()` coercion.
- TOC slugs can change for Unicode letters, CJK, combining marks, emoji, punctuation, separator runs, leading/trailing separators, and duplicate headings. Migration must not promise unique duplicate slugs or an external slugger.
- Removal of `ContentFile.plain`, `mdast`, and `hast` remains governed by issue 19; built-ins migrate to controlled private requests rather than replacement public getters.

### Test oracle and acceptance tests

The implementation must add deterministic tests at the public root interface and private fake-capability seam:

1. **Surface and types:** both direct root types expose exactly `toc`, `excerpt`, and `metadata` in addition to ordinary schema behavior; wrapped schemas need not expose them. Root-package negative type/export tests reject top-level projection functions, `TocOptions`, `.project()`, private request types, and removed `ContentFile` derived fields. Built declarations contain `metadata(): Schema<Metadata>` and `toc(): Schema<TocItem[]>` with no TOC parameter.
2. **Input selection:** for every primary/projection kind and both dialects, explicit text differing from the file body is the selected request text; absent input uses the file body. Equal explicit and fallback text with the same origin/profile produce byte/value-identical results.
3. **Empty behavior:** absent fallback and explicit `''` each produce `The content is empty` at the demanding field path. Fake capability/parser counters remain zero. Whitespace-only and non-empty MDX expression-only fixtures do parse and produce the successful empty static results specified above.
4. **Static MDX and excerpt oracle:** fixtures containing prose, inline code, nested static JSX children, expressions, ESM, component names, and attributes prove that excerpt and metadata consume the same normalized full text while metadata does not truncate. Excerpt fixtures cover omitted/undefined default `260`; shorter, equal, and longer text; `length = 0`; synchronous rejection of every invalid JavaScript length category; truncation on ASCII space; exact `U+2026`; code points across surrogate pairs; permitted grapheme/combining splits; and no-visible-text versus empty-selected-input behavior. No JavaScript or component executes.
5. **Metadata correctness:** an independent reference implementation uses the exact `v`-flag regex and frozen table. Fixtures cover ASCII and curly internal apostrophes; leading, trailing, and repeated apostrophes; uppercase, lowercase, non-ASCII Latin letters, and decomposed combining sequences; mixed Latin/CJK separators; each listed interval's included start and excluded end; supplementary-plane surrogate pairs; unpaired surrogates; fractional `wordCount` without normalization; zero visible words; the `0.56` multiplier; the `265` divisor; ECMAScript `Math.round` boundaries; and minimum one minute. Markdown and MDX explicit/fallback pairs use the same oracle.
6. **Plugin/profile behavior:** parser syntax extensions affect dialect parsing and parse identity; transformer counters for remark, rehype, and recma remain zero for projection-only TOC/excerpt/metadata demands. Matching roots share one pristine parse; profile mismatch does not share. Root reference identity is irrelevant.
7. **TOC correctness:** Markdown and MDX fixtures assert flat source order, depth/title/slug, static JSX heading text, omitted expression-only headings, explicit/fallback equivalence, and no primary render/compile. Independent slug fixtures cover locale-independent lowercase, NFC composition, Unicode whitespace, punctuation removal, ASCII and non-ASCII Latin letters, CJK, emoji-only empty slugs, combining marks, underscores, collapsed hyphens, leading/trailing separators, and duplicate equal slugs without suffixes. Contract tests and docs expose no external slugger, `original`, or upstream TOC options. JavaScript callers receive no tested compatibility behavior for extra arguments.
8. **Isolation and lifecycle:** concurrent sibling order does not change values; projection-only requests create no primary branch or effects; every record outcome disposes all retained parse/projection artifacts under the broker disposal oracle.
9. **Migration tests:** before/after fixtures cover each removed top-level form, root dialect selection, removal of `original`, no `.project()` rewrite, metadata value changes from raw-source counting, and negative package imports. Automated rewrites must not invent a dialect when it cannot be proven.
10. **Performance acceptance:** issue 25 must add metadata to Markdown and MDX combined and projection-only semantic workloads. Hard structural counters require one pristine parse for matching primary/TOC/excerpt/metadata demands, zero primary/transform/compile work for projection-only demand, and no retained artifacts after disposal. Metadata wall time may initially be advisory, but correctness, invocation counts, and the combined-overhead calculation are hard gates.

The isolated reference implementation used by correctness tests must parse each demand independently with the same dialect/profile and apply the semantics above. Its excerpt, slug, and metadata calculators must be test-owned implementations of the written algorithms rather than imports of candidate-private helpers. Candidate sharing passes only when its values, field diagnostics, invocation eligibility, and lifecycle counters match that oracle; current pre-1.0 getters are not the reference.

### Impact on other tickets

- **Make performance acceptance executable** must carry the exact default/explicit excerpt algorithm, Unicode slug fixtures with equal duplicate slugs, and metadata regex/range calculator into candidate correctness and retained oracle hashes. Its `length: 160` benchmark demand and metadata-specific advisory timing policy remain unchanged.
- **Define content schema migration guidance** must carry the excerpt code-point/ellipsis and invalid-option changes, Unicode/empty/duplicate slug behavior, and exact metadata regex/ranges in addition to the migration consequences above. This ticket does not edit or resolve that reopened migration decision.
- **Approve the complete 1.0 content derivation design** remains blocked by tickets 21-25 and the subsequent migration/VFile disposition work.
- Tickets 21-24 are neither changed nor newly constrained beyond carrying these controlled projection descriptors through their already-planned ownership, transaction, and generation seams.

The broker, pristine AST, VFile and seed, generic projection protocol, projection result cache, current helper identity, and root object identity remain private, absent, or non-semantic exactly as previously decided. This value oracle adds no public representation or internal seam.

## Reopened by final approval review

Ticket 11 found that the public value oracle is still incomplete. Resolve the excerpt default, unit, truncation, trimming, ellipsis, and invalid-length rules; the TOC slug and duplicate-heading rules; and the exact metadata apostrophe and Unicode-range specification. The result must be independently calculable without treating scattered pre-1.0 implementation code as an implicit contract.

This reopening request is satisfied and superseded by the final projection value oracle, migration consequences, acceptance tests, and cross-ticket impacts recorded above.
