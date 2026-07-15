# Safe Reuse Boundaries of Unified and MDX Processors

Research for [Establish the safe reuse boundaries of Unified and MDX processors](https://github.com/zce/velite/issues/388), part of [Design the 1.0 shared content derivation kernel](https://github.com/zce/velite/issues/387).

## Scope and versions

This report uses only first-party documentation, source, tests, and formal package APIs. It focuses on the versions selected by Velite at the research base commit: `unified@^11.0.5`, `@mdx-js/mdx@^3.1.1`, `remark-parse@^11.0.0`, `remark-gfm@^4.0.1`, `remark-rehype@^11.1.2`, and `rehype-stringify@^10.0.1`.[1][2]

## Concise answer

The safe default reuse unit is a frozen, configuration-specific processor plus one pristine parsed tree per source and syntax configuration. The pristine tree may be read directly by demonstrably read-only derivations such as TOC or excerpt extraction. Every branch that calls arbitrary Unified transformers must receive its own deep tree clone and its own VFile. A transformed tree is reusable only by consumers that start at exactly that phase, expect exactly that tree ecosystem, and do not need a different or earlier plugin chain.

For Markdown, a CommonMark/GFM mdast can be shared by Markdown HTML, TOC, excerpt, references, and custom mdast derivations only when every consumer agrees on the complete parse extension configuration. For MDX, parse with the MDX processor and share that MDX-extended mdast with MDX-aware, read-only TOC/excerpt/custom derivations. Never parse MDX with a CommonMark/GFM parser and feed that tree to the MDX compiler: JSX, expressions, and ESM have already been represented incorrectly or rejected, and MDX also intentionally changes ordinary Markdown syntax.

Do not treat `run` output as a general shared content tree. A Markdown HTML pipeline typically changes mdast to hast during `run`; the MDX pipeline continues further from mdast through hast to an ESTree-compatible `Program`. The resulting hast can feed HTML stringify and hast derivations only after the same remark/rehype prefix. The resulting MDX `Program` can feed the matching MDX stringify and recma-level inspection only after the same complete MDX transform chain. Compiled HTML or JavaScript is a terminal artifact reusable only when all output-affecting options and file semantics match.

## Sourced facts

### Unified phase and artifact semantics

1. Unified defines `process` as `parse -> run -> stringify`. `parse` invokes the configured parser only, `run` invokes the transformer pipeline only, and `stringify` invokes the configured compiler only. Each method freezes its processor before use.[3][4]
2. `run(tree, file)` does not clone `tree`. It passes the supplied object through the transformer pipeline, and a transformer may inspect or change the tree and VFile, return a replacement tree, perform asynchronous work by returning a promise, or stop with an error.[3][4]
3. `stringify(tree, file)` does not run transformers. Its compiler receives exactly that tree and a VFile. Compiler results are normally `string` or `Uint8Array`, but a registered compiler may return another result type.[3][4]
4. Unified's documented bridge mode preserves an origin tree after a destination processor runs, while mutate mode changes the current ecosystem and continues with the destination tree. `remark-rehype` without a destination processor is mutate mode: subsequent plugins receive hast, not mdast.[3][5]
5. The unist specification requires compliant tree values to be JSON-expressible and round-trip through JSON. Standard parsed unist trees are therefore structurally cloneable plain data. Arbitrary plugins are still JavaScript and can violate that convention by attaching non-standard values.[6]

### Parser extensions and Markdown/MDX compatibility

1. `remark-parse` installs a parser whose extension arrays come from processor data: `micromarkExtensions` and `fromMarkdownExtensions`. Syntax plugins therefore affect parse, even though their attachers run at processor freeze time.[7]
2. `remark-gfm` mutates processor data at freeze time by appending GFM micromark, from-markdown, and to-markdown extensions.[8] A tree parsed without that extension has already lost GFM distinctions such as tables, autolink literals, task-list metadata, strikethrough, and footnotes; adding `remark-gfm` during a later `run` cannot recover them.
3. `remark-mdx` similarly appends MDX micromark and mdast extensions. MDX parsing produces five extra node kinds: `mdxFlowExpression`, `mdxJsxFlowElement`, `mdxJsxTextElement`, `mdxTextExpression`, and `mdxjsEsm`; expression and ESM nodes can carry embedded ESTree under `data.estree`.[9][10][11]
4. MDX is not merely CommonMark plus extra nodes. Its official syntax disables indented code and Markdown autolinks, replaces HTML with JSX, and requires unescaped `<` and `{` to follow MDX grammar. Thus the same bytes can parse differently, or fail, under Markdown and MDX.[12]
5. `@mdx-js/mdx#createProcessor` fixes format when the processor is created. The official troubleshooting guide says `format: 'detect'` cannot work with `createProcessor` and Unified because Markdown and MDX require different plugin configuration; format-aware `compile` creates the appropriate processor per resolved file.[2][13][14]
6. The MDX processor pipeline is, in order: `remark-parse`; optionally `remark-mdx`; MDX's own remark normalization; user remark plugins; `remark-rehype` with all MDX node types passed through; user rehype plugins; hast-to-ESTree conversion; MDX recma transforms; optional JSX build; JavaScript stringify setup; and user recma plugins.[14]
7. MDX's first remark transform demonstrably mutates its mdast: it changes node types, splices parent children, and adds `data._mdxExplicitJsx` markers, explicitly noting mutation for speed.[15] A pristine parsed MDX tree cannot be retained by passing the same object to MDX `run`.
8. MDX nodes have no direct HTML representation. The first-party mdast utility documents that they must be explicitly passed through when converting to hast.[11] Ordinary `remark-rehype` instead applies its unknown-node behavior unless configured with handlers or `passThrough`, so an arbitrary Markdown-to-HTML pipeline is not an MDX renderer.[5]
9. MDX's public `createProcessor` JSDoc return type is `Processor<Root, Program, Program, Program, string>`.[14] Consequently, the formal `run` input is a `Program`, not the parsed `Root`, even though Unified's internal `process` passes parse output into the first transformer and MDX's runtime pipeline necessarily starts with mdast. Velite's current manual `processor.run(mdast)` requires `@ts-expect-error`; that split is an implementation-dependent runtime seam, not a type-supported MDX API contract.[14][16]

### Processor freezing, reuse, mutation, and concurrency

1. A processor freezes explicitly or on the first phase call. Freeze invokes plugin attachers once and stores returned transformer functions. A frozen processor cannot be reconfigured with `use` or mutable `data`; calling it creates an unfrozen descendant with the same attachers and a deep-copied processor data namespace.[3][4]
2. Plugin attachers run at freeze, not at `use`. They may install parsers or compilers, change processor data, and return transformer closures. Those closures persist for every `run` on that frozen processor.[3][4]
3. Unified does not impose purity or reentrancy on plugins. A transformer may mutate its tree or file and may close over mutable state established by its attacher.[3][4] Reusing a processor therefore reuses plugin instances/closures, not just immutable configuration.
4. Unified's `run` and its `trough@2.2.0` implementation keep traversal index, values, and completion callback local to each invocation. The framework itself can overlap separate runs, including promise-based transformers.[4][17] This does not make an arbitrary shared transformer closure concurrency-safe.
5. Calling a processor to make a descendant replays its attacher list and creates fresh transformer closures when that descendant freezes. Unified deep-copies processor data, but its `copy()` passes the original attacher parameters back through `use`; plugin option objects/functions are not a general deep-isolation boundary.[4]
6. `runSync` and `processSync` throw when asynchronous transforms do not finish synchronously; `run` and `process` are the APIs that support promise or callback transformers.[3][4]

### VFile, path, and data semantics

1. Unified creates a VFile from each compatible input unless the input already looks like a VFile. A parser receives `(document, file)`, each transformer receives `(tree, file)`, and a compiler receives `(tree, file)`.[3][4]
2. VFile stores raw `value`, `path`/path history, `cwd`, arbitrary mutable `data`, mutable `messages`, source maps, and custom results. Plugins can change path, append messages, and use data to pass information across phases.[18]
3. A string compatible is file content, not a path. Path-aware processing requires a VFile or an object such as `{path, value}`.[18]
4. Constructing a VFile from another VFile or object is documented as a shallow copy. Nested objects in `data` are not thereby isolated.[18]
5. MDX output can depend on file/options beyond source bytes: format detection uses path extension in `compile`; source maps identify the file; diagnostics report its path; and `baseUrl` resolves ESM and `import.meta.url` semantics.[2][13][19]

### Compiler expectations

1. `rehype-stringify` installs a compiler that expects a hast `Root` and serializes it with `hast-util-to-html`; it does not accept mdast or an MDX ESTree `Program` by contract.[20]
2. The MDX compiler expects the full transform chain to yield an ESTree-compatible `Program`; recma transforms mutate that program into an MDX component and JavaScript stringify serializes it. Output depends on options including `outputFormat`, development mode, JSX runtime/import source, provider, base URL, and user recma plugins.[2][14][19]
3. MDX's `outputFormat: 'function-body'` and `'program'` produce materially different programs. The former rewrites imports/exports and may require a `baseUrl`; the latter emits a module.[2][19]

## Safe reuse matrix

| Artifact                       | Markdown HTML                                      | MDX code                                                           | Excerpt / TOC                                    | Custom derivations                     | Safe conditions                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw source bytes/string        | Yes                                                | Yes                                                                | Yes                                              | Yes                                    | Always immutable; still choose the correct parser and VFile metadata per derivation.                                                                                                                 |
| Frozen processor configuration | Yes                                                | Yes                                                                | N/A or yes                                       | Yes                                    | Reuse by exact format/plugin/options key only; safe concurrently only when all plugin instances are reentrant and do not carry per-file mutable state. Otherwise create/freeze a descendant per job. |
| Pristine CommonMark/GFM mdast  | Yes                                                | No for MDX sources                                                 | Yes                                              | Yes for mdast consumers                | Complete parser extensions must match. Read-only consumers may share the object; transformer branches clone first.                                                                                   |
| Pristine MDX-extended mdast    | Not as equivalent Markdown HTML                    | Runtime-capable but not type-supported through public `run(mdast)` | Yes, with MDX-aware semantics                    | Yes for MDX-aware mdast consumers      | Must come from the matching MDX processor, include embedded ESTree, and be cloned before any transformer. Static extraction must define how JSX/expressions contribute text/headings.                |
| Post-remark mdast              | Only for a branch with the identical remark prefix | Only for identical MDX remark prefix                               | Possibly                                         | Only consumers after that exact prefix | Earlier derivations cannot use it if plugins removed/replaced content. Clone before diverging mutable branches. `@mdx-js/mdx` exposes no official pause point here.                                  |
| Post-rehype hast               | Yes for matching HTML pipeline                     | Not enough for final MDX code                                      | HAST-based derivations only                      | HAST consumers only                    | Same remark conversion and rehype prefix. MDX nodes need MDX pass-through/handling. Clone before divergent rehype transforms. `@mdx-js/mdx` exposes no official intermediate result.                 |
| Post-recma MDX `Program`       | No                                                 | Yes                                                                | Recma inspection only                            | Recma/ESTree consumers only            | Exact complete MDX options and plugin prefix. Clone before any additional mutating recma branch.                                                                                                     |
| HTML string                    | Terminal reuse only                                | No                                                                 | String-only extraction, if intentionally defined | String consumers only                  | All parse, transform, stringify, and VFile-dependent semantics match.                                                                                                                                |
| MDX JavaScript string          | No                                                 | Terminal reuse only                                                | No source-level TOC/excerpt                      | String/code consumers only             | All MDX and minifier options, plugin configuration, source, path/base URL, and relevant file data match.                                                                                             |
| VFile                          | No shared mutable instance                         | No shared mutable instance                                         | No shared mutable instance                       | No shared mutable instance             | Create one per branch, carrying the same immutable source identity/path/value and intentionally copied seed data. Merge messages/effects explicitly.                                                 |

## Architectural inferences for Velite

The following are recommendations derived from the sourced behavior, not promises made by Unified or MDX.

### 1. Cache parse artifacts by syntax configuration, not merely content

A parse cache key must include at least source identity/version, format (`md` versus `mdx`), and the ordered parse-extension configuration contributed by plugins and options. `gfm: true` is only one part of that identity. Any plugin that changes `micromarkExtensions` or `fromMarkdownExtensions` changes the parse language and invalidates reuse.

Velite should have separate Markdown and MDX parse entries. A `.mdx` file should use the matching MDX parser even when the immediate consumer is only TOC or excerpt. This avoids both lost MDX nodes and MDX/CommonMark grammar mismatches.

### 2. Make the canonical parse tree pristine and read-only by policy

The kernel should never pass its cached canonical tree directly to `processor.run` or an untrusted custom derivation. Built-in TOC, excerpt, and reference extraction can read the canonical tree without cloning if their implementations remain synchronous/read-only. Custom derivations should be presumed mutating unless they enter through an explicitly read-only API that does not expose the mutable tree.

For every transform branch, deep-clone the canonical tree immediately before the first transformer. The cost is linear in the represented tree size and memory is proportional to concurrently retained branch clones. MDX clones are larger because expression/ESM nodes can contain nested ESTree. Avoiding clones for proven read-only extraction is therefore meaningful; sharing a mutable branch to save cloning is not safe.

Cloning the pristine standard tree through `structuredClone` should work under the unist JSON-value rule and for first-party MDX ESTree data. It is not safe to assume that a tree already touched by arbitrary plugins remains cloneable. Functions, weak collections, symbols, host objects, or plugin-created cycles/non-standard class instances can fail or change semantics. Clone before user plugins, not after them.

### 3. Treat processor reuse and tree reuse as separate decisions

A frozen processor can be cached by exact configuration to avoid repeated attachment/configuration. That says nothing about whether its transformer closures are safe to invoke concurrently. Velite cannot promise concurrent processor reuse for arbitrary Unified plugins because the plugin API permits closure state and side effects.

A conservative 1.0 contract should either:

- serialize uses of each shared configured processor;
- create/freeze an isolated descendant processor per file/branch; or
- state that plugin instances must be reentrant and that non-reentrant plugins require an isolation option.

Processor isolation does not isolate mutable objects supplied as plugin options. Velite should treat plugin configuration as immutable after registration and document that plugins must not mutate shared option objects.

### 4. Fork VFiles with trees

Each branch needs a distinct VFile initialized with the same canonical `path`, `value`, and `cwd`, plus deliberately seeded data. Do not pass a source path as the second argument string to `run`/`stringify`: Unified interprets it as file value. Do not use `new VFile(existing)` as if it deeply isolated `data`.

Branch-local messages, path changes, maps, and data must be merged or exposed by an explicit kernel policy. Side effects such as linked-asset collection should not occur independently in multiple branches without deduplication/commit semantics.

In the current `src/core/content/mdx.ts`, `ProcessMdxOptions.path` is not supplied to `parse`, `run`, or `stringify`, and manual phase calls each create a new empty VFile. Thus parse-, transform-, and compiler-time plugins do not share one file object, do not receive the declared path, and cannot reliably communicate through `file.data` or `file.messages`. A future kernel must preserve one branch VFile across all phases.

### 5. Do not expose MDX `parse -> run(mdast)` as a stable kernel foundation yet

The current implementation's manual MDX split works with the inspected runtime pipeline but contradicts `@mdx-js/mdx`'s public processor generic and already needs a TypeScript suppression. It should not become a public Velite 1.0 guarantee without either an upstream-supported API, a locally owned MDX processor composition whose phase types are explicit, or a version-pinned compatibility test proving the seam.

An alternative is to let the official MDX processor own `process` while a first remark plugin captures a pristine clone for TOC/excerpt. That preserves the supported compile path but does not remove clone cost and makes capture/plugin order part of the design. Another alternative is to own the first-party-equivalent pipeline in Velite, which increases maintenance burden. This is a design tradeoff, not resolved by the package APIs.

### 6. Share only exact transform prefixes

A shared post-transform artifact is valid only when derivations have an identical ordered prefix and VFile semantics. This can theoretically form a derivation DAG:

1. source plus VFile seed;
2. format-specific pristine mdast;
3. identical remark prefix;
4. mdast-to-hast conversion;
5. identical rehype prefix;
6. HTML stringify or MDX hast-to-recma;
7. identical recma prefix;
8. JavaScript stringify/minify.

However, the normal Unified API exposes `run` as one complete transformer list, and `@mdx-js/mdx` does not expose its intermediate mdast/hast states. Prefix sharing therefore requires explicit composition seams or capture plugins. The simplest safe first design is parse sharing plus independent cloned runs; deeper prefix sharing should be justified by measurements.

### 7. Define TOC and excerpt semantics for MDX

Generic mdast visitors can see standard heading and text nodes inside an MDX tree, but expressions and JSX children are not plain text. A heading such as `# Hello {name}` cannot have a complete static title without evaluating JavaScript, and a component can render arbitrary headings/text. Velite should define TOC/excerpt as static source-AST derivations, specify which MDX nodes are ignored or represented, and never imply equivalence to rendered component output.

## Concurrency limits

- Separate pristine trees plus separate VFiles can be processed concurrently by the same frozen processor only if every installed parser/compiler/transformer closure and every referenced option/dependency is reentrant.
- The same mutable tree must not be sent to overlapping `run` calls. Mutation order and returned-tree identity would race.
- The same VFile must not be shared across overlapping branches. `data`, `messages`, `history`, `value`, maps, and custom fields are mutable.
- Parsing can overlap on one frozen processor when its parser and extension objects are read-only during parse. Unified itself keeps no per-parse cursor on the processor, but arbitrary parsers/extensions are not guaranteed reentrant.
- Stringifying can overlap only when the compiler closure is reentrant and each call receives the correct tree and separate file. First-party `rehype-stringify` closes over immutable-looking settings and delegates to `toHtml`, but this does not generalize to custom compilers.
- Async transformers are safe only through `run`/`process`, not sync APIs. Completion order must not determine shared effects or output ordering.

## Uncertainties requiring a prototype

1. **Typed MDX phase split:** pin `@mdx-js/mdx@3.1.1` and test `parse -> clone -> run(tree, sameVFile) -> stringify` against `process` across MDX JSX, ESM, expressions, GFM, user async remark/rehype/recma plugins, source maps, diagnostics, and both output formats. Determine whether an upstream-supported typing/API exists before adopting this seam.
2. **Clone mechanism and cost:** benchmark `structuredClone`, a unist-specific deep clone, and reparsing on representative large Markdown and MDX files. Measure time and peak memory, including embedded ESTree and multiple concurrent branches. Test failures when plugins add non-standard `data` before an attempted checkpoint.
3. **Processor reuse under real plugins:** build adversarial plugins with attacher closure state, async delay, option mutation, VFile data/messages, and tree mutation. Compare one shared frozen processor, serialized use, and per-job descendants. This should set the kernel's documented concurrency/isolation contract.
4. **Intermediate-prefix value:** prototype a minimal explicit Markdown/MDX pipeline that can stop after remark and rehype, then measure whether sharing those checkpoints materially beats parse-only sharing after clone costs. Do not add this complexity without representative end-to-end evidence.
5. **MDX static derivation semantics:** test proposed TOC/excerpt behavior for headings and prose containing JSX, expressions, imported components, and nested Markdown inside JSX. The remaining question is product semantics, not parser capability.

These uncertainties fit the existing design map and do not require new child issues solely from this research ticket; they should be addressed by the map's prototype/API/benchmark decisions.

## Sources

1. [Velite `package.json` at research base commit](https://github.com/zce/velite/blob/533812f7a881c9ccbc02d9af6cf088668865a7fa/package.json)
2. [`@mdx-js/mdx` official API and architecture](https://mdxjs.com/packages/mdx/)
3. [`unified@11.0.5` official README/API](https://github.com/unifiedjs/unified/blob/11.0.5/readme.md)
4. [`unified@11.0.5` processor implementation](https://github.com/unifiedjs/unified/blob/11.0.5/lib/index.js)
5. [`remark-rehype@11.1.2` official README/API](https://github.com/remarkjs/remark-rehype/blob/11.1.2/readme.md)
6. [unist specification, node data and JSON expressibility](https://github.com/syntax-tree/unist/blob/3.0.0/readme.md#node)
7. [`remark-parse@11` parser implementation](https://github.com/remarkjs/remark/blob/15.0.1/packages/remark-parse/lib/index.js)
8. [`remark-gfm@4.0.1` extension registration](https://github.com/remarkjs/remark-gfm/blob/4.0.1/lib/index.js)
9. [`remark-mdx@3.1.1` extension registration](https://github.com/mdx-js/mdx/blob/3.1.1/packages/remark-mdx/lib/index.js)
10. [`@mdx-js/mdx@3.1.1` node type list](https://github.com/mdx-js/mdx/blob/3.1.1/packages/mdx/lib/node-types.js)
11. [`mdast-util-mdx@3` official syntax tree and HTML notes](https://github.com/syntax-tree/mdast-util-mdx/blob/3.0.0/readme.md)
12. [Official MDX syntax and Markdown deviations](https://mdxjs.com/docs/what-is-mdx/#markdown)
13. [Official MDX troubleshooting: format detection and processor configuration](https://mdxjs.com/docs/troubleshooting-mdx/#unexpected-format-detect)
14. [`@mdx-js/mdx@3.1.1` processor construction](https://github.com/mdx-js/mdx/blob/3.1.1/packages/mdx/lib/core.js)
15. [`@mdx-js/mdx@3.1.1` mutating remark normalization](https://github.com/mdx-js/mdx/blob/3.1.1/packages/mdx/lib/plugin/remark-mark-and-unravel.js)
16. [Current Velite `src/core/content/mdx.ts`](https://github.com/zce/velite/blob/533812f7a881c9ccbc02d9af6cf088668865a7fa/src/core/content/mdx.ts)
17. [`trough@2.2.0` per-invocation pipeline state](https://github.com/wooorm/trough/blob/2.2.0/lib/index.js)
18. [`vfile@6.0.3` official API](https://github.com/vfile/vfile/blob/6.0.3/readme.md)
19. [`@mdx-js/mdx@3.1.1` recma document transform](https://github.com/mdx-js/mdx/blob/3.1.1/packages/mdx/lib/plugin/recma-document.js)
20. [`rehype-stringify@10` compiler implementation](https://github.com/rehypejs/rehype/blob/13.0.2/packages/rehype-stringify/lib/index.js)
