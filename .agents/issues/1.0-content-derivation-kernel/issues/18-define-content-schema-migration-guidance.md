# Define content schema migration guidance

Status: resolved
Created: 2026-07-17T16:42:00Z
Type: grilling
Blocked by: 06, 07, 19, 20, 23, 24

---

## Question

What exact breaking changes, automated or manual migration steps, diagnostics, and documentation should guide existing configurations from independent top-level `s.markdown()`, `s.mdx()`, `s.toc()`, and `s.excerpt()` schemas to the 1.0 schema-rooted derivation-family interface, including plugin configuration and custom content schemas?

## Answer

### Decision

Velite 1.0 makes a clean break to dialect-rooted content derivation families. It provides no compatibility getters, runtime proxy, public broker or AST replacement, CLI codemod, publication compatibility path, or user-facing revision adapter. Migration is supported by an exact breaking-change inventory, checked-in and tested narrow ast-grep recipes, detect-only rules, manual before/after guidance, and executable type/runtime/semantic/lifecycle evidence.

The final public projection surface is:

```ts
const markdown = s.markdown(options)
const mdx = s.mdx(options)

markdown.toc()
markdown.excerpt({ length: 160 })
markdown.metadata()

mdx.toc()
mdx.excerpt({ length: 160 })
mdx.metadata()
```

The top-level `s.toc`, `s.excerpt`, and `s.metadata` properties do not exist. `TocOptions`, `original`, `.project()`, public content capabilities, public AST/VFile access, and the root `createBuilder` export also do not exist in the 1.0 public contract.

Automation levels in this answer mean:

- **Auto:** a checked-in ast-grep recipe may rewrite only the stated syntactically proven-safe form.
- **Detect:** tooling reports the location and required decision but makes no edit.
- **Manual:** no reliable static signal or behavior-preserving rewrite exists.

### Breaking-change inventory

| ID    | Change and affected users                                                                       | Before                                                                                          | After                                                                                                                                                          | Automation                                                            | Diagnostic and documentation direction                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BC-01 | Top-level TOC, excerpt, and metadata removal; all users of these schemas                        | `s.toc()`, `s.excerpt(options)`, `s.metadata()`                                                 | A method on an explicit `s.markdown()` or `s.mdx()` root                                                                                                       | Auto only for the narrow direct-sibling forms below; otherwise Detect | Native TypeScript missing-property error or native JavaScript failure; migration guide maps the error category to the root method without promising custom compiler/runtime text |
| BC-02 | Root family and wrapper behavior; users wrapping a root before creating projections             | A primary schema and unrelated top-level projections                                            | Create projections from the direct unwrapped root; apply `.optional()`, `.transform()`, `.pipe()`, or other wrappers only to the primary field                 | Manual for wrapped roots                                              | Document that ordinary Zod wrappers need not preserve family methods                                                                                                             |
| BC-03 | TOC option removal; users following the old documentation                                       | `s.toc({ original: true })` or a documented `TocOptions` type                                   | `root.toc()` with no argument                                                                                                                                  | Detect                                                                | Delete the argument and redesign document-TOC rewriting outside Velite; there is no replacement shim                                                                             |
| BC-04 | Generic projection reservation removal; users relying on design previews or internals           | `root.project(...)` or a proposed recipe interface                                              | Ordinary custom Zod schema, or one of the three finite built-in root methods                                                                                   | Detect                                                                | Negative type/export/runtime coverage; do not advertise a renamed recipe helper                                                                                                  |
| BC-05 | Selected-input and empty-input semantics; users passing explicit projection values              | TOC could ignore explicit input; excerpt/metadata used different explicit and fallback paths    | Every primary/projection selects `explicit string ?? file.content`; missing or exact `''` produces field-local `The content is empty` and zero parse work      | Manual behavioral review                                              | Add explicit/fallback, empty, whitespace-only, and no-visible-text tests                                                                                                         |
| BC-06 | Dialect-aware static projection semantics; Markdown/MDX users                                   | Top-level projections used implicit Markdown-only derived state                                 | Root dialect and exact parse profile determine TOC, excerpt, and metadata                                                                                      | Auto only when dialect is syntactically proven                        | Ambiguous dialect is a required human decision, never a guessed default                                                                                                          |
| BC-07 | Metadata value semantics; all metadata users                                                    | Explicit input counted raw source while fallback used Markdown-only `file.plain`                | Both use complete dialect-aware normalized static visible text with fixed counting constants                                                                   | Manual value review                                                   | Publish exact before/after fixtures and require candidate values to match the Ticket 20 oracle, not old getter output                                                            |
| BC-08 | TOC output semantics and unsupported arguments; TOC users                                       | Documentation described upstream tree/options behavior not implemented by the schema            | Flat source-ordered `{ depth, title, slug }[]`; no argument                                                                                                    | Detect                                                                | Remove upstream `mdast-util-toc` options/result claims and `original` references                                                                                                 |
| BC-09 | Plugin order; users combining global and root-local plugins                                     | Current implementation registers root-local lists before global lists                           | Global plugins precede root-local plugins within each phase; order and duplicates are preserved                                                                | Manual                                                                | Add ordering and duplicate-invocation tests and a prominent behavior-change note                                                                                                 |
| BC-10 | Parser extension and transformer isolation; plugin users/authors                                | Static projections and parser/transformer participation were not a stable split                 | Parser syntax extensions participate in pristine parsing/profile identity; returned remark, rehype, and recma transformers do not run for static projections   | Manual                                                                | Document phase responsibilities and zero-transform projection counters                                                                                                           |
| BC-11 | Plugin concurrency responsibility; stateful plugin authors                                      | Sequential/global order could be assumed accidentally                                           | Records and demands may run concurrently with no global document order; closure/global state, direct I/O, randomness, and external effects remain plugin-owned | Manual                                                                | State that Velite neither detects nor isolates hidden plugin state                                                                                                               |
| BC-12 | VFile continuity; plugin authors observing parse-time state                                     | One object across shared parse and every branch could be inferred                               | Immutable parse seed carries the supported state by value; every transforming branch has a fresh VFile whose identity is continuous only within that branch    | Manual                                                                | Document supported `cwd`, `history`, data, and message seed graphs, deterministic compatibility failure, and no no-share marker                                                  |
| BC-13 | `ContentFile` derived fields; custom schemas using `file.mdast`, `file.hast`, or `file.plain`   | Velite-owned mutable/Markdown-only derived values                                               | `ContentFile` contains only `id`, `path`, and optional `content`; custom schemas parse `value ?? file.content` themselves                                      | Detect only                                                           | Native missing-property errors plus migration examples; JavaScript reads of removed fields yield normal absent-property behavior                                                 |
| BC-14 | Custom content sharing; custom schema authors and deep importers                                | Runtime/source internals could be reached or a public replacement expected                      | No public broker, AST, VFile, generic demand, request constructor, cache key, lifecycle, or projection protocol                                                | Detect for known deep imports; otherwise Manual                       | Root-package-only guidance and negative declarations/exports/reflection tests                                                                                                    |
| BC-15 | Root `createBuilder` removal; direct composition users                                          | `createBuilder` exported from `velite`                                                          | Use public `builder()`, `build()`, or `watch()`; internal compositions are unsupported                                                                         | Detect                                                                | Native missing-export/module errors; no public host/runner installer or reset API                                                                                                |
| BC-16 | Custom effect declaration signature; custom effect authors                                      | `collectEffect(effect)` with caller-provided owner/system provenance                            | `collectEffect(effect, { path, declaration, occurrence })`; payload omits owner/system provenance                                                              | Detect only                                                           | Provide semantic-path and every stable occurrence variant before/after examples                                                                                                  |
| BC-17 | Effect transaction behavior; users relying on invalid-record effects or unique winner selection | Successful siblings could leak effects; one unique participant could survive accidentally       | An invalid record loses all effects; every unique-conflict participant is invalid and loses its complete effect set                                            | Manual behavioral review                                              | Explain record-atomic discard and simultaneous symmetric conflicts                                                                                                               |
| BC-18 | Prepare diagnostic interface; hook authors                                                      | Readonly-at-type-level mutable diagnostics and optional returned replacement diagnostics        | Detached recursively immutable core snapshot plus the sole append-only `addDiagnostic()` sink; `PrepareResult.diagnostics` removed                             | Detect for returned diagnostics; Manual for mutation logic            | Runtime immutability, normalized causes, stable hook keys, and closed-sink behavior must be documented                                                                           |
| BC-19 | Strict policy timing and scope; strict users                                                    | Facade upgraded errors after a build and later watch operations could escape strict             | Durable Builder policy runs before staging/publication for full, manual, initial watch, rebuild, patch, and reload operations                                  | Manual behavioral review                                              | Strict failure publishes nothing and preserves the previous generation                                                                                                           |
| BC-20 | `prepare(false)` semantics; prepare users                                                       | Early return could bypass gates and reconcile ordinary files directly                           | After all fatal/strict gates pass, commit the new internal generation and an explicitly empty Velite-owned published generation                                | Manual behavioral review                                              | `BuildResult.written` is empty; failed operations retain both old internal and published generations                                                                             |
| BC-21 | Last-successful generation semantics; build/watch users                                         | Failed patch/reload behavior was not one atomic contract                                        | Failed full, patch, staging, commit, or reload leaves the complete previous successful generation current                                                      | Manual behavioral review                                              | Document continued serving of old output and shadow-reload failure behavior                                                                                                      |
| BC-22 | Physical data publication; all existing output directories                                      | Mutable ordinary output directory and per-file writes                                           | Immutable generation directories plus one atomically replaceable configured live pointer                                                                       | Manual one-time operation                                             | Require explicit clean or one-time migration before first 1.0 publication; never silently delete-and-link during commit                                                          |
| BC-23 | Managed asset naming; users with custom fixed output templates                                  | Non-hashed fixed managed destinations were accepted                                             | Every Velite-managed destination has adequate content-addressed identity                                                                                       | Detect configuration, Manual choice                                   | Default `[name]-[hash:8].[ext]` remains valid; fixed templates must add a hash or move ownership outside Velite                                                                  |
| BC-24 | Post-commit diagnostics; `BuildResult` consumers                                                | Cleanup/reporting failure could be conflated with generation failure                            | Committed generation diagnostics remain immutable; cleanup/reporting failures appear separately as `operationalDiagnostics`                                    | Detect property consumers where practical                             | Confirmed commit is never reported as uncommitted                                                                                                                                |
| BC-25 | Cancellation option removal; direct Builder users                                               | `BuildOptions.signal` existed but was unused                                                    | No `signal` field and no public hard-cancellation promise                                                                                                      | Detect                                                                | Remove the option; explain settle-and-fence behavior and potentially unbounded drain for a never-settling plugin Promise                                                         |
| BC-26 | Watch readiness, reload, and disposal; watch users                                              | Initial build preceded subscription; reload replaced the session directly; disposal was shallow | Ready coverage precedes snapshot, reload warms/catches up/commits a shadow epoch, old work drains without publication, close/dispose is awaitable and terminal | Manual behavioral review                                              | Document last-successful service, stale hook side effects, terminal method failure, and drain responsibility                                                                     |
| BC-27 | Recovery and cleanup; operators                                                                 | Ordinary manifest/stale deletion behavior                                                       | Validate current pointer and sealed descriptor; corrupt ownership authorizes no deletion; stale cleanup is post-commit retryable GC                            | Manual operations                                                     | Require explicit repair/clean for corrupt publication metadata and report cleanup failures operationally                                                                         |
| BC-28 | Benchmark revision adapter; contributors reading acceptance machinery                           | Cross-version adapter might be mistaken for migration support                                   | Adapter exists only inside the Ticket 25 harness                                                                                                               | None for users                                                        | Explicitly state it is not importable product API, compatibility shim, codemod, dialect guesser, or correctness oracle                                                           |

No additional Markdown or MDX option rename is authorized by this ticket. Any future option change is a new public decision and cannot be filled in during implementation without updating this inventory.

### Removed property behavior

The top-level properties are completely absent. This is stronger and simpler than a throwing migration aid:

| Observation                                        | Required 1.0 result                                                |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| TypeScript `s.toc`, `s.excerpt`, or `s.metadata`   | Native missing-property compiler error; no promised custom wording |
| JavaScript property read                           | `undefined`, as for any absent ordinary property                   |
| JavaScript call                                    | Native not-a-function failure; no promised custom wording          |
| `Object.keys(s)` / `Reflect.ownKeys(s)`            | No removed property                                                |
| `'toc' in s`, `'excerpt' in s`, `'metadata' in s`  | `false`                                                            |
| Root declarations, runtime exports, and export map | No removed value or compatibility subpath                          |

Throw-on-access getters are rejected because an own getter remains visible to `Reflect.ownKeys`, an inherited getter remains visible to `in`, and either keeps a runtime compatibility path. A proxy is rejected because it makes absence dependent on trap behavior, preserves a hidden compatibility channel, and complicates reflection invariants. Neither is a clean deletion or a deep interface.

### Root migration forms

#### Existing named root

```ts
const content = s.mdx({ remarkPlugins: [remarkGfm] })

const schema = s.object({
  code: content,
  toc: content.toc(),
  excerpt: content.excerpt({ length: 160 }),
  metadata: content.metadata()
})
```

This is the preferred migration when primary and siblings share non-default profile options. Existing named roots are rewritten manually unless a future recipe can prove the lexical binding without ambiguity; the approved recipes do not perform data-flow or scope reconstruction.

#### Inline root

```ts
const schema = s.object({
  html: s.markdown(),
  toc: s.markdown().toc(),
  excerpt: s.markdown().excerpt({ length: 160 }),
  metadata: s.markdown().metadata()
})
```

Independent equivalent roots are semantically valid and share matching pristine parses. Inline form is suitable for default or fully literal profiles, but named form avoids profile drift.

#### Wrapped primary

Before:

```ts
const schema = s.object({
  html: s.markdown(options).optional(),
  toc: s.toc()
})
```

After:

```ts
const content = s.markdown(options)

const schema = s.object({
  html: content.optional(),
  toc: content.toc()
})
```

Extraction is manual. The complete original wrapper chain remains on the primary field, while projections originate from the unwrapped root. Mechanical extraction is unsafe because it can introduce a name collision, move evaluation, duplicate a dynamic expression, change side effects, or accidentally drop root methods behind a wrapper.

### Dialect decision policy

Automation may select Markdown or MDX only from one unique, direct, unwrapped sibling root in the same object literal. It must not infer dialect from a collection glob, filename extension, output field name, sibling completion, object-key order, loader, old top-level behavior, or another file.

If no primary sibling exists, the projection is an **orphan projection** but not an implicit Markdown projection. Tooling reports it and requires the user to choose:

```ts
toc: s.markdown().toc()
// or
toc: s.mdx().toc()
```

Defaulting an orphan to Markdown is rejected. Although it can reproduce the old top-level parser in some cases, it can silently preserve wrong semantics for an MDX source and contradict the root model's explicit dialect requirement. If both dialect roots are present or dialect is otherwise ambiguous, the same detect-only rule applies.

### ast-grep delivery and safety boundary

Velite does not ship `velite migrate` or another CLI codemod. The migration work must check in versioned ast-grep recipes and positive/negative fixtures, and the migration guide must link to them and repeat their limitations. A docs-only prose checklist remains necessary but is not sufficient evidence because executable recipes can drift without tests.

An automatic root-projection rewrite is allowed only when all of these conditions are syntactically established:

1. The call is a direct `s.toc()`, `s.excerpt(...)`, or `s.metadata()` property in one object literal.
2. The same object literal contains exactly one direct unwrapped `s.markdown(...)` or `s.mdx(...)` primary value and no competing dialect root.
3. The root has no argument, or its argument is a recursively JSON-like literal containing only object/array literals and primitive literals with static keys.
4. The excerpt options, if present, are likewise recursively JSON-like literal data.
5. The rewrite creates an equivalent inline root call and does not introduce a binding, move an expression, or alter another property.

The recipes must report without editing when any of these appears:

- orphan or multiple/ambiguous roots;
- existing named-root identifiers;
- wrapped roots;
- object spreads, computed properties, dynamic construction, schema factories, unions, lazy schemas, or helper-returned shapes;
- identifiers, member access, calls, `new`, `await`, `yield`, assignments, updates, spreads, getters, or computed keys in root/projection options;
- plugin arrays, plugin tuples, or other plugin option expressions;
- `s['toc']`, aliases of `s`, or unsupported dynamic access.

The boundary intentionally refuses to copy dynamic or plugin expressions. Even when a particular expression happens to be pure, a syntax-only recipe cannot generally prove getter behavior, call effects, evaluation count, lexical binding, or profile identity. Users migrate those cases through one manually named root.

Other checked-in rules are detect-only:

| Rule                   | Detection                                                                                                                     | Manual action                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Removed content fields | `context().file.mdast/hast/plain`, destructured `file`, and typed `ContentFile` property access                               | Select input, parser, dialect, plugins, and ownership explicitly                |
| Unsupported imports    | Known `velite/dist/*`, source/core/content/schema internals, broker/context host, generation, epoch, or instrumentation paths | Use supported root exports or remove the dependency                             |
| Effect declaration     | One-argument `collectEffect(...)` and caller-owned provenance fields                                                          | Add semantic declaration context and remove forged owner/source data            |
| Prepare diagnostics    | Returned `diagnostics`, mutation of context diagnostics, or copied core diagnostics                                           | Use `addDiagnostic()` with a stable key                                         |
| Cancellation           | `BuildOptions.signal` or `build({ signal })`                                                                                  | Remove it and use lifecycle/disposal expectations rather than hard cancellation |
| Fixed asset names      | Configured managed templates with no adequate hash token                                                                      | Add a hash-bearing template or own the external destination outside Velite      |

Plugin side effects, global document-order assumptions, semantic metadata value dependencies, strict timing dependencies, external prepare I/O, publication-directory ownership, and watch lifecycle assumptions remain manual because syntax cannot establish intent.

### Metadata migration oracle

Metadata keeps the public shape and fixed counting constants:

```ts
interface Metadata {
  readingTime: number
  wordCount: number
}
```

- Latin words use the established apostrophe-aware rule.
- Each Han, Hiragana, or Katakana character in the fixed Ticket 20 ranges contributes `0.56`.
- Every non-empty selected source uses `max(1, round(wordCount / 265))`.

The input text changes from raw-source-or-Markdown-only behavior to complete normalized static visible text. For this explicit input:

```mdx
# Hello

<Callout title="Hidden">Visible text</Callout>

{secret}

export const x = 1
```

the pre-1.0 raw explicit-input counter sees eleven Latin words: `Hello`, `Callout`, `title`, `Hidden`, `Visible`, `text`, `Callout`, `secret`, `export`, `const`, and `x`. The 1.0 MDX static-visible-text oracle is `Hello Visible text`, so the expected result is:

```ts
{ readingTime: 1, wordCount: 3 }
```

Equal explicit and fallback selected text with the same path, dialect, and profile must produce equal values. The old fallback getter and fixed benchmark baseline are not correctness oracles. Fixtures must additionally cover Markdown syntax, comments, inline code, nested static JSX children, expressions, ESM, JSX names/attributes, apostrophes, mixed Latin/CJK, every maintained range boundary, fractional counts, rounding boundaries, and a non-empty source with zero visible words.

### Custom schema migration

Custom schemas remain ordinary black-box Zod schemas. A schema that needs a derived representation explicitly selects the same raw fallback a built-in would use:

```ts
const source = value ?? context().file.content
```

It then owns its parser, Markdown/MDX choice, parser extensions, transformers, VFile, AST, text extraction, mutation, caching, I/O, side effects, concurrency, and disposal. Separate Markdown and MDX factories or an explicit dialect option are recommended for reusable schemas.

Velite provides no compatibility field for `mdast`, `hast`, or `plain`, no defensive public AST snapshot, no readonly AST proxy, no public broker capability, and no generic projection recipe. Self-parsing is sufficient because raw selected text and source metadata remain available; repeated parsing is an accepted 1.0 tradeoff for keeping the public extension seam small and ownership-safe.

Deep/source importers receive no substitute for private `SchemaRunContext`, `SchemaContextHost`, `SchemaRunner`, leases, content requests, branch outcomes, broker/cache state, dialect adapters, VFile seeds, generation/publication state, or instrumentation. Only root package exports are compatible.

### Plugin and VFile migration

Plugin configuration follows ordinary Unified semantics with these explicit 1.0 constraints:

1. Global plugin lists precede root-local lists in each phase. Order and duplicate registrations are preserved; no deduplication or option merge beyond normal `.use()` semantics is promised.
2. The complete effective parser registration sequence participates conservatively in parse-profile identity because an attacher can install syntax extensions and return a transformer.
3. Parser syntax extensions affect the pristine parse used by TOC, excerpt, and metadata. Returned remark, rehype, and recma transformers execute only in transforming primary branches, not static projections.
4. Parser participants must be deterministic and reentrant for a fixed profile. There is no no-share marker, dynamic eligibility probe, hidden-state detection, or retry as unshared parsing.
5. Plugin authors own closure/global state, direct I/O, randomness, timing, and external effects. Records and demands may run concurrently and have no global document order.
6. A shared parse uses one internal parse VFile and captures an immutable seed. Each transforming branch receives independent tree and VFile state. The same branch VFile object continues through that branch's run/stringify/compile phases, but no object identity crosses from parse into every branch or between sibling branches.
7. Only Ticket 22's supported `cwd`, ordered `history`, supported plain-object/array data graph, and supported parse-message graph cross the seed seam. Unsupported opaque values produce the documented plugin/configuration compatibility diagnostic rather than reference sharing, silent omission, or a no-share fallback.

The migration guide must not promise processor count, processor identity, freeze timing, pooling, locking, clone strategy, the current manual MDX phase split, or cross-branch VFile identity.

### Effect migration

Every custom declaration changes from:

```ts
context().collectEffect(effect)
```

to:

```ts
context().collectEffect(effect, {
  path: ['attachments'],
  declaration: 0,
  occurrence: { kind: 'source-index', index }
})
```

`path` is a caller-declared record-rooted semantic declaration path, not an actual Zod issue path inferred by Velite. `declaration` is stable construction metadata. `occurrence` is exactly one of `singleton`, `source-position`, `source-index`, or `key`, under Ticket 23's validation rules. Dynamic arrays use an intrinsic source index, stable key, or source position; append/call/completion order is invalid provenance.

The effect payload contains only the supported unique or asset declaration fact. Callers remove `owner`, collection, source, selected-input, record, or other system provenance; Velite validates and adds that data. Submitted payload and descriptor graphs are synchronously detached. Malformed custom declarations create deterministic schema diagnostics and no effect.

Effects remain record-atomic. If any local field invalidates a record, every effect from every successful sibling is discarded. A unique conflict invalidates all participating records simultaneously, emits an associated diagnostic for each, and discards every participant's complete effect set. No winner is chosen by source, append, or completion order.

### Prepare migration

The 1.0 hook shape is conceptually:

```ts
prepare: (collections, { project, diagnostics, addDiagnostic }) => {
  addDiagnostic({
    key: 'missing-summary',
    level: 'warn',
    code: 'MISSING_SUMMARY',
    message: 'Some records have no summary'
  })

  return { collections }
}
```

`diagnostics` is the actual detached normalized recursively immutable core snapshot carried into publication policy. Its array, diagnostic objects, provenance, positions, contexts, and normalized causes are frozen at every level. It does not retain original mutable `Error`, `Date`, `Map`, `Set`, binary, function, symbol, host-object, or cyclic references. Mutation may throw or fail silently depending on JavaScript semantics, but it cannot change the snapshot or final diagnostics.

`addDiagnostic()` is the only hook diagnostic channel. A declaration requires a stable non-empty key; Velite fixes prepare stage, hook origin, and project-wide provenance. It is snapshotted synchronously. Exact duplicates collapse, conflicting reuse of one key produces a fatal prepare diagnostic, and call/completion order has no semantic meaning. The sink closes when the awaited hook settles, and a late call cannot alter the completed or a later build.

Remove every `{ diagnostics }` return value and every attempt to push, splice, reorder, delete, replace, mutate, copy-and-downgrade, or impersonate a core diagnostic. A prepare throw/rejection or malformed diagnostic is fatal. Hook-owned external I/O and side effects remain outside rollback; this is especially relevant when a shadow candidate later becomes stale.

### Strict, publication, output, asset, and watch migration

`strict` is a durable policy supplied through the public Builder entry and copied into every operation. It is evaluated after prepare diagnostic finalization and before staging. A strict rejection writes no data generation, publishes no asset reference, deletes no old output, and leaves the last successful generation current. The facade only converts the already rejected operation into `VeliteError`; it does not decide strict after publication.

`prepare(false)` records output suppression rather than early success. On a clean operation it commits new internal records, effects, final diagnostics, and logical output plus an empty Velite-owned published-output generation. `BuildResult.output` reflects the committed internal logical output and `written` is empty. Only after that pointer commit are prior Velite outputs eligible for cleanup. Any fatal, strict, prepare, staging, or commit failure preserves both previous internal and published generations.

Data publication moves from an ordinary mutable directory to immutable generation directories behind one atomically replaced configured live pointer. Before the first 1.0 publication, an existing ordinary directory at `output.data` must be removed through the existing explicit clean path such as `velite build --clean`, `velite dev --clean`, or `Builder.clean()`, or through a documented one-time migration operation. A normal commit must never convert it through a non-atomic delete-and-link sequence. Corrupt, escaped, missing-target, or tampered publication metadata similarly requires explicit repair/clean and authorizes no broad deletion.

Every Velite-managed asset destination must contain adequate content-addressed identity. The default `[name]-[hash:8].[ext]` template remains valid. A fixed template such as `[name].[ext]` must add a hash-bearing segment or move destination ownership outside Velite. Immutable blobs may be written speculatively, but only a committed generation pointer makes references current. Destination collisions for different bytes are fatal rather than first/last-writer-wins.

Cleanup is post-commit retryable garbage collection based only on validated old/new committed manifests. Cleanup, logger, or reporting failure cannot roll back or misreport a confirmed commit. It is returned separately through `BuildResult.operationalDiagnostics`; committed generation diagnostics remain unchanged.

`BuildOptions.signal` is removed. Velite does not promise hard cancellation across Zod, Unified, shared parse work, or arbitrary plugin Promises. Lifecycle leases, tokens, and publication fences prevent late commitment. A plugin Promise that never settles can therefore make drain/disposal wait indefinitely.

Watch establishes ready event coverage before its initial snapshot. Reload creates a warming shadow epoch, journals and replays relevant events, and swaps only after the candidate is caught up, finalized, staged, and atomically committed. Failed config loading or shadow work retains the old active epoch and generation. After a successful swap, the old epoch stops admission; admitted operations may settle but cannot publish, then it drains and disposes. Watch close and Builder disposal are awaitable, idempotent per object, and terminal. Calls admitted before Builder disposal may finish; calls submitted after disposal begins fail and cannot recreate an epoch.

### Benchmark adapter boundary

Ticket 25's revision-specific adapter is acceptance-harness infrastructure only. It may emit old top-level schemas for fixed baseline `3903ba3bdcfe9ce987f69f2de799d218a939c677` and final root methods for the candidate so equal semantic workloads can be timed. It is not shipped, imported from user config, documented as a migration helper, used to guess dialect, or accepted as a candidate correctness oracle. Benchmark counters, event sinks, broker details, generation IDs, epoch state, fences, and lifecycle debug operations remain internal test seams.

### Documentation, examples, types, and tests to update

Implementation/spec follow-up must update, at minimum:

| Area                                                                       | Required updates                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/guide/velite-schemas.md`                                             | Move all three projections under both roots; define wrappers, selected input, empty input, static visible text, metadata constants, flat TOC; delete top-level sections, `TocOptions`, and `original` |
| `docs/guide/define-collections.md`                                         | Replace top-level examples with named roots; remove `file.plain`; add custom self-parse and dialect-choice guidance                                                                                   |
| `docs/guide/quick-start.md`                                                | Use one named Markdown root; explain generation pointer, first clean, content-addressed assets, and last-successful watch behavior                                                                    |
| `docs/guide/custom-schema.md`                                              | Define black-box self-parse ownership, two-argument effect declarations, stable occurrence, and absence of broker/AST/diagnostic registry                                                             |
| `docs/guide/using-mdx.md` and plugin guides                                | Add MDX projections, global-before-local order, parser-extension/profile participation, transformer isolation, VFile seed continuity, concurrency responsibility, and unsupported state               |
| `docs/guide/migration.md`                                                  | Add the complete inventory, error-category index, before/after gallery, recipes, detect/manual checklist, physical migration, and unsupported-behavior alternatives                                   |
| `docs/guide/lifecycle.md`                                                  | Remove derived `ContentFile` fields; define leases, record effects, generations, shadow reload, drain, and terminal disposal                                                                          |
| `docs/reference/types.md`                                                  | Update `ContentFile`, effects, `PrepareContext`, immutable diagnostics, `BuildResult.operationalDiagnostics`, and removed `signal`/internal exports                                                   |
| `docs/reference/config.md` and API/CLI references                          | Define root plugin order, hash template requirement, prepare sink, pre-publication strict, `prepare(false)`, clean migration, watch/reload/disposal                                                   |
| `examples/basic`, `examples/vite`, `examples/nextjs` and embedded snippets | Use named roots; retain plugin profiles visibly; remove all top-level projection calls                                                                                                                |
| Public API/type/dist tests                                                 | Negative top-level properties, `TocOptions`, `.project()`, `createBuilder`, removed fields, `signal`, private imports/types; positive final roots, effects, prepare, and operational diagnostics      |
| Schema semantic tests                                                      | Both dialects, explicit/fallback/empty inputs, static text, metadata exact oracle, flat TOC, parser extensions, zero static transformers, sharing/isolation/disposal                                  |
| Effect/prepare tests                                                       | Stable descriptors, forged provenance rejection, invalid-record discard, symmetric unique conflict, recursive runtime immutability, sole sink, late sink, canonical order                             |
| Strict/publication/output/asset tests                                      | Zero publication on failure, full/patch equivalence, empty publication, atomic pointer, first-clean rejection, content-addressed collision, recovery, post-commit cleanup diagnostics                 |
| Watch/lifecycle tests                                                      | Ready subscription, journal/replay/watermarks, failed/successful shadow reload, revoked old fences, drain/dispose, terminal operations, parallel Builder isolation                                    |
| Migration tooling tests                                                    | Auto positive fixtures and every detect-only negative boundary, including ambiguous/orphan dialect, dynamic/plugin options, named roots, wrappers, and unsupported imports                            |
| Acceptance harness                                                         | Harness-only revision adapter, all three projections, final metadata oracle, structural counters, private-export evidence, and independent evidence recalculation                                     |

This list identifies follow-up surfaces and acceptance evidence, not an implementation plan.

### Unsupported behavior and alternatives

| Unsupported in 1.0                                           | Supported alternative                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Top-level projection property or compatibility getter        | Explicit Markdown/MDX root method                                                  |
| TOC `original` or upstream option passthrough                | Implement document rewriting in user-owned processing                              |
| Generic `.project()` or custom shared projection             | Ordinary custom Zod schema with owned parsing                                      |
| Public broker, pristine AST, VFile, seed, or cache controls  | Finite built-in projections or self-owned parser/processor                         |
| `ContentFile.mdast/hast/plain`                               | Parse `value ?? file.content` under an explicit dialect/profile                    |
| Automatic dialect guess for orphan/ambiguous projection      | Manual `s.markdown()` or `s.mdx()` selection                                       |
| Stateful/non-reentrant parser participant or no-share marker | Make parser setup deterministic/reentrant; own unshared parsing in a custom schema |
| Custom effect identity from call/completion order            | Stable source position, source index, key, or valid singleton                      |
| Effect from an invalid/conflicting record                    | Fix validation/conflict; no partial record effect commit                           |
| Prepare mutation/replacement/downgrade of core diagnostics   | Append a prepare-stage diagnostic through `addDiagnostic()`                        |
| Fixed mutable Velite-managed asset destination               | Hash-bearing managed template or external user-owned destination                   |
| In-place ordinary output-directory conversion                | Explicit clean/one-time migration followed by pointer publication                  |
| Public hard cancellation                                     | Await terminal close/dispose; design plugin Promises to settle                     |
| Importing harness adapters/counters/generation debug state   | Consume retained acceptance reports, not runtime internals                         |

### Evidence required by final approval

The final approval ticket can accept migration completeness only when one evidence index maps every BC item above to all applicable artifacts:

1. A before/after configuration fixture or explicit manual-only scenario.
2. Its affected user group and value/runtime/lifecycle consequence.
3. Auto, Detect, or Manual classification with a tested positive and negative boundary where tooling exists.
4. Native TypeScript/runtime behavior described without fabricated custom error text.
5. Root declarations, built declarations, runtime exports, export map, and reflection evidence for every removed/private surface.
6. Markdown and MDX semantic oracles, including exact metadata changes and explicit/fallback equivalence.
7. Custom self-parse, plugin order/profile/transform isolation, VFile seed, effect descriptor/discard, and immutable prepare evidence.
8. Strict, `prepare(false)`, failed full/patch/reload, generation pointer, asset identity, recovery, operational diagnostics, watch drain, and terminal disposal evidence.
9. Documentation, examples, type references, API/CLI references, and tests updated with no contradictory old contract.
10. Ticket 25's complete raw acceptance bundle, independent recalculation, structural gates, and private-export report, with the revision adapter identified as harness-only.

Approval must fail if any public behavior is still described as an implementation-time choice, if old metadata is used as the candidate oracle, if removed properties remain reflection-visible, if recipes guess dialect or copy dynamic/plugin expressions, if old output is converted non-atomically, or if benchmark infrastructure is presented as user compatibility API.

### Superseded clauses

This answer replaces the ticket's entire previous answer. In particular:

- The old Q3 throw-on-access getter decision is superseded by complete property removal and negative type/runtime/export/reflection behavior.
- The old Q4 orphan-projection Markdown default is superseded by detect-only reporting and mandatory explicit dialect selection.
- The old Q5 TypeScript-readonly-only prepare decision is superseded by Ticket 23's detached recursively immutable runtime snapshot and sole append-only sink.
- The old BC-10 implementation-time TOC choice is superseded by deletion of `TocOptions` and `original` with no shim.
- Any old text retaining top-level `s.toc`, `s.excerpt`, or `s.metadata`, promising custom native TypeScript/module error wording, or treating getters as non-shim migration aids is superseded.
- Any old text omitting global-before-local plugin order, parser extensions in profile identity, transformer-free static projections, immutable parse seed continuity, custom occurrence descriptors, record-atomic discard, core pre-publication strict, empty publication, last-successful generation, pointer layout, content-addressed assets, operational diagnostics, terminal disposal, or `BuildOptions.signal` removal is superseded.
- The old ast-grep boundary permitting a default dialect or loosely copying sibling options is superseded by the exact syntactic Auto/Detect/Manual boundary above.
- Any implication that Ticket 25's revision adapter is a product shim, migration API, or candidate correctness oracle is superseded.

### Effects on related tickets

- **Ticket 04:** preserves the schema-rooted family, independent siblings, wrapper limitation, and root-reference irrelevance; removes no final method selected by Ticket 20.
- **Ticket 06:** adds complete migration coverage for global-before-local order, duplicates, parser-profile participation, static transformer isolation, and plugin-owned concurrency/external state.
- **Ticket 07:** preserves custom schemas as black boxes and rejects public `.project()`, broker, AST, VFile, and generic recipe replacements.
- **Ticket 09:** preserves declarative effects, record-atomic failure, last-successful state, and post-commit cleanup while using Tickets 23 and 24's executable provenance, diagnostic, strict, asset, and generation refinements.
- **Ticket 19:** migrates removed `ContentFile` fields to self-parsing, keeps the eight-field public context, and exposes no private content capability.
- **Ticket 20:** applies the exact three root methods, no top-level forms, no TOC options, selected-input/empty behavior, static visible text, metadata constants, and migration oracle.
- **Ticket 21:** records root `createBuilder` removal and gives no public host/runner/carrier/lease installation or reset path.
- **Ticket 22:** documents immutable seed-by-value continuity, branch-local VFile identity, deterministic/reentrant parser responsibility, unsupported seed state, and no no-share marker.
- **Ticket 23:** replaces one-argument custom effects and mutable/returned prepare diagnostics with stable declarations, record transactions, runtime immutable snapshots, and one sink.
- **Ticket 24:** incorporates durable strict, empty publication, last-successful generations, atomic pointer migration, content-addressed assets, operational diagnostics, removed cancellation, shadow reload, drain, and terminal disposal.
- **Ticket 25:** keeps revision adapters and instrumentation harness-only, uses final metadata correctness rather than baseline values, and supplies the acceptance evidence expected by final approval.
- **Ticket 11:** is unblocked by this migration decision but remains responsible for the complete final design review and all evidence conditions above. This answer does not begin that review or implementation planning.

No product code, documentation, examples, tests, knowledge files, benchmark implementation, prototype, or report was changed while resolving this decision.

## Reopened by final approval review

Ticket 11 is the pre-implementation design approval that decides whether the map can hand off to implementation planning. Revise the evidence language so Ticket 11 approves the completeness and executability of the migration evidence contract, while checked-in documentation, examples, tests, tooling fixtures, and completed benchmark evidence remain mandatory post-implementation acceptance artifacts rather than prerequisites that cannot exist before design approval.

## Final resolution after reopening

### Scope and decision

The reopening is resolved by separating two phases that the earlier answer conflated:

1. **Design approval evidence contract:** the complete inventory, artifact schemas, mappings, independent oracles, automation boundaries, acceptance responsibilities, and failure conditions that Ticket 11 can inspect before implementation.
2. **Post-implementation acceptance artifacts:** the checked-in documentation, examples, recipes, fixtures, declarations, built distributions, export and reflection reports, runtime and lifecycle traces, benchmark bundles, and independent recalculations produced after implementation.

Ticket 11 approves the first phase for completeness, determinism, executability, and implementation readiness. It does not require fabricated implementation results or artifacts that cannot exist before implementation. The second phase remains mandatory for implementation and release acceptance.

The existing BC-01 through BC-28 identifiers remain stable. Their corrected clauses below are normative, and three independently owned migration changes are added as BC-29 through BC-31. No compatibility shim, public debug interface, implementation ticket, implementation plan, product migration adapter, or new public/internal coordination seam is introduced.

### Final breaking-change inventory amendments

The following amendments supersede the less specific rows and prose in the earlier answer:

| ID    | Final change and affected users                                                                | Before                                                                                                                 | After                                                                                                                                                                                                         | Automation                                                                           | Independent migration oracle                                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BC-07 | Metadata values; every metadata consumer                                                       | Raw explicit input or Markdown-only fallback-derived text                                                              | Complete dialect-aware normalized static visible text, exact Latin regex and frozen CJK table, `wordCount = latinCount + cjkCount * 0.56`, `readingTime = Math.max(1, Math.round(wordCount / 265))`           | Manual value review                                                                  | Test-owned calculator implements the written regex, ranges, code-point iteration, arithmetic, and rounding without candidate or pre-1.0 helpers                   |
| BC-08 | TOC values; every TOC consumer                                                                 | ASCII-oriented or upstream-implied slug behavior and unspecified duplicate handling                                    | Flat source-ordered `{ depth, title, slug }[]`, Velite-owned Unicode slug algorithm, equal duplicate slugs, no argument or `TocOptions`                                                                       | Detect unsupported arguments; Manual value review                                    | Test-owned slug calculator and Markdown/MDX fixtures cover NFC, Unicode categories, separators, empty slugs, duplicate slugs, and source order                    |
| BC-18 | Prepare diagnostics; prepare-hook authors                                                      | Mutable or shallow-readonly diagnostics and optional returned replacement diagnostics                                  | Recursive runtime-immutable `Diagnostic[]`, exact normalized values, sole `addDiagnostic(PrepareDiagnosticInput)` sink, and no `PrepareResult.diagnostics`                                                    | Detect returned diagnostics; Manual mutation/cause review                            | Public shape, runtime declaration validation, independent normalizer/comparator, recursive mutation, closed-sink, and negative private-surface fixtures           |
| BC-24 | Post-commit results; `BuildResult` consumers and operators                                     | Cleanup/reporting could be conflated with commitment or happen after result return                                     | Pointer commit, synchronous in-memory install, awaited finite first cleanup attempt, immutable operational snapshot, then immutable `BuildResult` construction and return                                     | Detect result-property use where practical; Manual lifecycle review                  | Logical event trace proves sequence and immutable separation; confirmed commit remains success under cleanup/logger/reporting failure                             |
| BC-26 | Watch/reload/Builder disposal; watch and Builder users                                         | Shallow disposal and ambiguous late-operation authority                                                                | Explicit admission; `open -> disposing -> disposed`; pre-disposal admitted operations retain ordinary publication authority while disposal waits; epoch supersession remains an independent revocation reason | Manual behavioral review                                                             | Controlled state-machine interleavings prove admission-before-dispose, dispose-before-admission, epoch supersession, terminality, and wait-set behavior           |
| BC-27 | Recovery and cleanup; operators                                                                | Ordinary manifest/stale deletion and unspecified residue handling                                                      | Sealed current/predecessor/backlog recovery, manifest-authorized retryable cleanup, no directory-scan ownership inference, unknown residue retained for explicit clean                                        | Manual operations                                                                    | Cold-start and crash fixtures use only validated persisted metadata and prove corrupt or unverifiable state authorizes no deletion                                |
| BC-29 | Excerpt configuration and values; every excerpt consumer                                       | UTF-16 slicing, no exact suffix contract, coercible invalid lengths, or unspecified defaults                           | Default `260`; non-negative safe-integer length; Unicode code-point truncation; `trimEnd()` plus one `U+2026`; exact empty/no-visible-text behavior                                                           | Detect statically invalid literal options where sound; otherwise Manual value review | Test-owned code-point calculator and exact boundary fixtures; candidate-private and pre-1.0 helpers are forbidden                                                 |
| BC-30 | Exported diagnostic model; all `Diagnostic`, build-result, error, and prepare consumers        | Mutable diagnostic objects, optional stage, closed code union, original causes, stacks, and incidental object identity | One exported normalized recursively immutable `Diagnostic` model with required stage/origin/provenance and exact `DiagnosticValue` tags                                                                       | Detect removed/changed fields; Manual cause/context review                           | Declarations, runtime own-key checks, independent normalization/comparison fixtures, and mutation probes at every depth                                           |
| BC-31 | Reader-safe generation and blob retirement; direct output readers, integrations, and operators | In-place or best-effort stale deletion with no supported reader window                                                 | Private Builder-local managed-reader leases; external current-plus-direct-predecessor generation-count window; complete protected-manifest blob retirement                                                    | Manual integration and operational review                                            | Persisted logical generation labels, lease event fixtures, protected-manifest reference checks, crash recovery, and no wall-clock or directory-enumeration oracle |

All other BC-01 through BC-28 rows remain in force where not superseded here. In particular, Auto remains limited to the narrow syntax-proven direct-sibling root rewrite. Tooling must Detect rather than edit orphan, ambiguous, named-root, wrapped-root, dynamic-option, plugin-option, alias, computed, spread, factory, union, lazy, or otherwise unproven forms. Manual remains required where intent, values, lifecycle, ownership, or dialect cannot be established syntactically.

### Final projection migration contract

The direct returns of `s.markdown(options)` and `s.mdx(options)` expose exactly these built-in family methods in addition to their ordinary schema interface:

```ts
toc(): Schema<TocItem[]>
excerpt(options?: { length?: number }): Schema<string>
metadata(): Schema<Metadata>
```

Ordinary wrappers need not preserve these methods. Top-level `s.toc`, `s.excerpt`, and `s.metadata` are absent as ordinary properties: TypeScript reports native missing-property errors; JavaScript reads return `undefined`; calls fail natively; `Object.keys`, `Reflect.ownKeys`, and the `in` operator reveal no removed property; declarations, runtime exports, and export maps contain no compatibility value or subpath. `TocOptions`, `original`, `.project()`, and a generic projection protocol are absent.

Every primary and sibling independently selects `explicit string input ?? ContentFile.content`. Explicit `''` wins and, like a missing fallback, produces field-local `The content is empty` with zero capability, parse-slot, parser, or projection work. Whitespace-only text parses normally. A non-empty source with no static visible text succeeds with excerpt `''`, TOC `[]`, and metadata `{ readingTime: 1, wordCount: 0 }`.

Excerpt uses normalized static visible text, defaults `length` to `260`, and accepts only a JavaScript number that is a non-negative safe integer. Invalid values synchronously throw `TypeError` without promised message text. ECMAScript string iteration supplies Unicode code points. Text at or below the limit is returned unchanged; otherwise the first `length` code points are joined, `trimEnd()` is applied, and exactly `U+2026 HORIZONTAL ELLIPSIS` is appended outside the limit. `length = 0` yields `…` for non-empty visible text and `''` for a non-empty selected source with no visible text. The algorithm may split grapheme clusters or combining sequences but never a valid surrogate pair.

TOC remains a flat source-ordered list. Static text, inline code, and static JSX descendants contribute to heading titles; expressions, ESM, JSX names and attributes, and comments do not. A heading with no static title is omitted. For each retained title, normalize NFC, apply locale-independent `toLowerCase()`, normalize NFC again, preserve Unicode `Letter`, `Number`, and `Mark` code points plus `_`, collapse maximal Unicode `White_Space` and ASCII hyphen runs to one interior `-`, and remove all other code points without replacement. There is no transliteration. Empty slugs are retained. Duplicate headings retain equal slugs without suffixes, and source order never changes slug values.

Metadata consumes the complete normalized static visible text and uses this exact Latin-word expression:

```js
;/(?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+(?:['’](?:[\p{Letter}&&\p{Script_Extensions=Latin}]\p{Mark}*)+)*/gv
```

The frozen CJK half-open code-point intervals are:

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

ECMAScript string iteration counts each listed code point once. `wordCount` receives no decimal normalization. Candidate correctness uses the written regex, table, `0.56`, `265`, and ECMAScript `Math.round`, never a pre-1.0 getter, `ContentFile.plain`, or candidate-private calculator. Markdown and MDX, explicit and fallback, combined and projection-only forms use the same respective oracle after dialect-aware parsing.

### Final diagnostic and effect migration contract

`Diagnostic` is the sole exported normalized snapshot type used by prepare, successful build results, operational results, and rejected public build errors. `ImmutableDiagnostic` is not a second public model. Its required top-level fields are:

```ts
interface Diagnostic {
  readonly level: 'error' | 'warn' | 'info'
  readonly code: string
  readonly message: string
  readonly stage: 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'
  readonly origin: { readonly kind: 'core' } | { readonly kind: 'prepare-hook'; readonly key: string } | { readonly kind: 'velite' }
  readonly provenance: DiagnosticProvenance
  readonly position?: DiagnosticPosition
  readonly context?: DiagnosticValue
  readonly cause?: DiagnosticValue
}
```

Only `position`, `context`, `cause`, and the explicitly optional nested fields in Ticket 23 may be absent. Produced diagnostics contain no unknown string or symbol fields. Provenance is the exact project, collection, source, or record tagged union from Ticket 23, including only its declared optional path/request fields. Project-wide facts use `{ scope: 'project' }`; no fabricated owner values are allowed. Positions, request provenance, stable occurrences, required non-empty strings, and safe-integer rules follow Ticket 23 exactly.

`DiagnosticValue` is the exact tagged normalization domain from Ticket 23: unchanged `null`, booleans, strings, and finite numbers except `-0`; tags for `undefined`, `nan`, positive/negative infinity, negative zero, bigint, and the three symbol scopes; sparse arrays with explicit hole items and sorted enumerable string properties; ordinary/null-prototype objects with sorted entries; accessor tags without invocation; Error tags containing name, message, optional normalized code and cause but no stack; Date epoch milliseconds or `null`; canonically sorted Map entries and Set values with multiplicity retained; lowercase-hex copied binary with its exact binary kind; `circular`; and opaque `function`, `class-instance`, `host-object`, `proxy`, `shared-binary`, or `reflection-failure` tags.

Error stacks, constructor/class names, host strings, function names, original references, alias identity, insertion order, Promise order, and memory identity are not retained or used for equality. A current-ancestor cycle becomes one unnumbered circular marker; non-ancestor repeated references normalize independently. Proxies are opaque before ordinary reflection. Map/Set order uses the independent canonical value comparator. Date, ArrayBuffer, DataView, and typed-array values become detached immutable data; shared binary is opaque. Every top-level and nested diagnostic, provenance, position, path, occurrence, tag, entry tuple, array, and object is detached and runtime immutable. Tests assert unchanged observation rather than a particular mutation exception or freeze implementation.

`PrepareDiagnosticInput` accepts exactly own data properties `key`, `level`, `code`, `message`, and optional `cause` on a non-Proxy ordinary or null-prototype plain record. Unknown string keys, symbol keys, accessors, inherited fields, empty key/code, or invalid levels are malformed. `addDiagnostic()` is the sole append-only hook channel. Velite supplies prepare stage, hook origin, and project provenance. Exact same-key normalized duplicates collapse; conflicting reuse produces a Velite-authored fatal prepare diagnostic with no winner. The sink closes when the awaited hook settles; late calls append nothing and cannot affect this or a later build. `PrepareResult.diagnostics` remains removed.

Custom effects use only:

```ts
collectEffect(effect, { path, declaration, occurrence })
```

`path` is a caller-declared record-rooted semantic declaration path, not a fabricated Zod issue path. `declaration` is a stable non-negative safe-integer construction ordinal. `occurrence` is exactly `singleton`, `source-position`, `source-index`, or `key` under Ticket 23's validation rules. Call order, append order, visitation counters, cache hits, and Promise completion are forbidden identity sources. Velite owns collection, source, selected-input, record, owner, and controlled request provenance; caller payloads cannot claim those fields. Inputs are synchronously validated and detached. Invalid records and every participant in a symmetric uniqueness conflict lose their complete effect candidates.

The diagnostic normalizer, Proxy detector, comparator implementation, effect transaction, diagnostic transaction, owner/source enricher, registry, collector, sink state, lease, content broker, branch outcome, and publication candidate remain private. None is a migration aid, public test interface, runtime export, declaration, export-map subpath, or reflection-visible capability. Public `SchemaContext` gains no diagnostic channel beyond Zod issues and retains only the approved two-argument `collectEffect` effect declaration operation.

### Final publication, cleanup, reader, and disposal migration contract

A successful full, patch, initial-watch, rebuild, or reload operation follows this exact post-staging order:

1. Validate base generation, watermark where applicable, fence, descriptor, and manifests.
2. Atomically replace the configured current pointer, which is the external commit linearization point.
3. Without an intervening `await`, install the committed in-memory generation and, for reload, the active epoch tuple, publication term, watermark, and old-epoch draining transition in the same critical section.
4. Release the critical section; commitment is now irrevocable.
5. Snapshot one finite canonically ordered cleanup plan from the complete protected manifests, newly retired manifests, and validated retry backlog.
6. Await exactly one first attempt in which every selected item reaches a terminal outcome.
7. Normalize observed cleanup/logger/reporting failures into a fresh immutable `operationalDiagnostics` snapshot.
8. Construct a detached immutable `BuildResult` from committed data, committed writes, committed diagnostics, and that operational snapshot.
9. Return without further I/O, user callback, or serialization.

Cleanup outcomes are `deleted`, `absent`, `failed`, terminal `timeout`, or `partially-deleted`. Failed, timed-out, and partially deleted items remain in the retry backlog; successful sibling deletions are not rolled back. A timeout is valid only when no hidden filesystem mutation remains active. Later retries produce later immutable reports or later results and never mutate an earlier result. `BuildResult.diagnostics` is the committed prepare-finalized snapshot; `BuildResult.operationalDiagnostics` is a distinct post-commit snapshot. Cleanup, logger, reporting, result-construction, or evidence-retention failure can never reclassify a confirmed pointer commit as uncommitted.

Managed readers acquire a private opaque Builder-local lease through the publication module. A lease pins one persisted publication identity and its validated generation directory, descriptor, data files, and referenced blobs. Lease acquisition linearizes with pointer observation and receives either the complete old or complete new generation. A never-released lease blocks its protected retirement and Builder disposal. No public reader registry, lease protocol, generation handle, cleanup handle, or wall-clock expiry exists.

External readers receive exactly a generation-count window: current plus its direct committed predecessor are protected. A reader that resolves generation `G` while current may rely on it through at most one successful pointer advance and must reacquire before the second. There is no indefinite path, opened-handle, duration, wall-clock grace, or best-effort filesystem promise.

The protected manifest set is the current manifest, direct predecessor manifest, and every live managed-reader-pinned manifest. A generation retires only when it is neither current nor predecessor, has no pin, validates under owned roots, and is explicitly retired by committed metadata or backlog. A content-addressed blob retires only when no manifest in the complete protected set references its identity and digest and validated committed transition/backlog authority exists. One old/new comparison, directory presence, source path, discovery history, or directory scan is insufficient.

Cold start reads only the configured pointer and sealed current descriptor, validates current/predecessor/backlog metadata, and reconstructs only those protected and retry facts. It never scans for the newest generation or infers ownership from names. Orphan staging, unknown trash, and unidentified blobs remain residue until explicit clean. Validated partial deletion and backlog entries retry idempotently. Corrupt, escaped, missing, inconsistent, or unverifiable metadata authorizes no publication or deletion. Explicit clean remains a separate destructive operator assertion with admission and containment checks.

Builder operation admission has one linearization point: while state is `open`, the coordinator assigns an operation ordinal and epoch and inserts the operation in its ledger. The first `dispose()` atomically performs `open -> disposing`, closes admission, and stores one shared settlement Promise. An operation admitted first retains its ordinary ability to derive, stage, obtain and validate a fence, commit, perform first cleanup, construct a result, and settle while disposal waits. If disposal linearizes first, the operation is not admitted and can never commit.

Builder disposal is not epoch supersession. An admitted operation may still lose authority through successful epoch replacement, stale base, stale watermark, consumed fence, or another established fence condition. Disposal alone is not an extra revocation reason. Disposal waits for all pre-disposal admitted operations, watch/scheduler/replay work, active cleanup attempts or retries admitted before disposal, warming/active/draining epochs and their actual resources, transaction/fence/engine/session/journal state, and live managed-reader leases. Persisted backlog with no active attempt does not block disposal. A never-settling plugin, non-terminal adapter operation, or never-released reader lease keeps disposal pending indefinitely; Velite fabricates no hard cancellation, timeout, forced release, or false terminal success.

Parallel Builders own separate admission ledgers, publication terms, epochs, fences, pins, protected manifests, cleanup plans, backlogs, and disposal Promises. The process-wide `SchemaContextHost` owns none of these. No generation registry, reader registry, transaction service, publication broker, lifecycle coordinator, cleanup handle, instrumentation service, or service locator becomes public or process-global.

### Design approval evidence contract

Before implementation, Ticket 11 can and must validate one migration evidence index whose schema requires every BC item to have:

1. One unique stable BC identifier.
2. Affected user groups and detectable entry points.
3. Exact before and after contracts.
4. Semantic, runtime, type, physical-layout, operational, or lifecycle consequences as applicable.
5. Exactly one automation class: Auto, Detect, or Manual, with the safe positive and negative boundary.
6. One or more explicit artifact kinds.
7. One accountable acceptance owner per artifact kind.
8. The phase in which each artifact must exist.
9. An independent positive oracle and applicable negative oracle.
10. Failure conditions that do not depend on private object identity, Promise completion order, wall-clock timing, directory enumeration, best-effort filesystem behavior, a live mutable registry, or candidate-private helpers.

The design approval index must cover public and private negative surfaces, root reflection absence, both dialects, explicit/fallback/projection-only behavior, all projection value rules, custom black-box schemas, plugin/VFile responsibility, complete diagnostic/effect normalization and transactions, strict/publication/result ordering, reader-safe retirement, recovery, admission/disposal, parallel Builder isolation, and Ticket 25's benchmark protocol schema.

Ticket 11 passes this migration portion of pre-implementation reapproval when the index is complete, internally consistent, independently executable, and contains no implementation-time choice, vague placeholder, accidental-current-behavior dependency, or missing owner/oracle/phase. It fails this portion if any BC item lacks a required field, any hard gate requires a forbidden private/live oracle, any Auto rule can cross its proven-safe boundary, or any contract contradicts Tickets 20, 23, 24, or 25.

Ticket 11 must not fail merely because implementation has not yet produced checked-in tests, built declarations, runtime reports, benchmark measurements, or other post-implementation facts. Requiring such artifacts before implementation would be circular and would encourage fabricated evidence. This resolution makes the migration design evidence contract ready for Ticket 11 reapproval; Ticket 11 still owns the complete-map review and does not receive an approval decision from this ticket.

### Post-implementation acceptance artifacts

After implementation, acceptance requires the actual artifacts promised by the design index:

- checked-in migration, schema, custom-schema, plugin, diagnostic, output, lifecycle, API, CLI, and performance documentation;
- migrated examples and embedded snippets for both dialects and named roots;
- checked-in ast-grep Auto recipes plus positive fixtures and every Detect/no-edit negative boundary fixture;
- source public types, generated declarations, built declarations, package exports, built runtime exports, unsupported deep-import reports, own-key and reflection reports;
- public type tests, runtime tests, semantic tests, independent projection calculators, diagnostic normalizer/comparator fixtures, effect/prepare transaction tests, recursive mutation probes, and private-surface negative tests;
- strict, `prepare(false)`, full/patch/reload, atomic-pointer, result-order, cleanup-outcome, retry, crash/cold-start, reader-window, protected-blob, admission/disposal, watch-journal, epoch-supersession, and parallel-Builder logical traces;
- built-dist smoke results and the complete Ticket 25 structural event/counter reports;
- release-host benchmark bundles, environment and dependency bridge evidence, raw samples, retained hashes, validity calculations, and independent recalculated verdicts.

The post-implementation acceptance phase fails when any inventory item lacks its mapped artifact; documentation, examples, types, runtime behavior, exports, or reflection still describe the old contract; an ast-grep recipe exceeds Auto safety or guesses a dialect; candidate correctness depends on a pre-1.0 result; lifecycle evidence cannot prove immutable result construction, reader-safe retirement, or admission/disposal rules; benchmark evidence is absent, incomplete, not independently recalculable, or exposes private identity; cleanup/reporting failure is reported as uncommitted; or any prohibited internal seam appears on a supported public surface.

### Artifact mapping and acceptance ownership

The following mapping is normative. Owners are acceptance responsibilities, not new implementation tickets or organizational roles:

| BC items                          | Required artifact kinds                                                                                                             | Acceptance owner                                | Independent oracle and phase                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| BC-01, BC-02, BC-03, BC-04, BC-06 | Migration guide, recipes/detections, root declarations, exports/reflection, before/after fixtures                                   | Public schema and migration-tooling acceptance  | Written root/absence/dialect/wrapper oracle; contract at design approval, artifacts after implementation |
| BC-05, BC-07, BC-08, BC-29        | Markdown/MDX semantic fixtures, test-owned excerpt/slug/metadata calculators, projection-only counters                              | Projection semantic acceptance                  | Ticket 20 written algorithms, never old/candidate helpers; contract before, tests/reports after          |
| BC-09, BC-10, BC-11, BC-12        | Plugin-order fixtures, parser/transform counters, VFile seed/isolation fixtures, unsupported-state diagnostics                      | Plugin and content-kernel acceptance            | Logical state/value/counter oracle without processor identity; contract before, tests after              |
| BC-13, BC-14, BC-15               | Public types, root export map, built declarations/runtime exports, deep-import and reflection negatives, custom self-parse examples | Public interface and custom-schema acceptance   | Supported root-package surface and distinct public view; contract before, reports/artifacts after        |
| BC-16, BC-17                      | Effect declarations, semantic path/ordinal/occurrence fixtures, record/unique transaction traces                                    | Effect transaction acceptance                   | Complete normalized effect identity and record-atomic promotion; contract before, tests/traces after     |
| BC-18, BC-30                      | Diagnostic declarations, independent normalizer/comparator, prepare fixtures, recursive mutation and sink-lifecycle traces          | Diagnostic and prepare acceptance               | Ticket 23 complete value/tag/immutability oracle; contract before, tests/reports after                   |
| BC-19, BC-20, BC-21               | Strict, empty-publication, last-successful full/patch/reload traces and outputs                                                     | Generation publication acceptance               | Complete immutable generation and sole commit seam; contract before, traces after                        |
| BC-22, BC-23                      | Pointer adapter, first-clean, generation layout, content-addressed asset, collision, export/runtime documentation                   | Output and asset publication acceptance         | All-old/all-new pointer and digest/reference oracle; contract before, adapter/integration evidence after |
| BC-24, BC-27, BC-31               | Commit/cleanup/result sequence, outcome/backlog, cold-start/crash, reader/pin/protected-manifest traces                             | Publication lifecycle and operations acceptance | Persisted labels and logical events, not clocks, scans, or identity; contract before, traces after       |
| BC-25, BC-26                      | Cancellation-removal types, watch/reload/admission/disposal state-machine traces                                                    | Builder/watch lifecycle acceptance              | Admission ledger and epoch-supersession oracles; contract before, tests/traces after                     |
| BC-28                             | Revision adapter source/hash, harness import-boundary report, structural and benchmark evidence bundle                              | Performance/release acceptance                  | Ticket 25 protocol and independent calculator; contract before, actual bundle/verdict after              |

Documentation and examples are additionally owned by migration-documentation acceptance for every BC item they mention. Public declaration/export/reflection negative evidence is additionally owned by public-interface acceptance for every removed or prohibited surface. These cross-cutting checks do not create duplicate semantic authorities; the written ticket oracle remains the single source for expected behavior.

### Ticket 25 evidence impact

Ticket 25 must carry the final projection calculators, complete diagnostic normalizer/comparator fixtures, effect and prepare counters, commit/first-cleanup/result sequence, every cleanup terminal outcome, immutable operational snapshots, reader acquire/release and protected-retirement events, predecessor retention, crash recovery, operation admission, disposal transitions, epoch supersession, parallel Builder isolation, private-export reports, and timed-region inclusion of the awaited first cleanup attempt and result construction.

Its revision-specific adapter remains acceptance-harness infrastructure only. It may express the old syntax for the fixed baseline and final root syntax for the candidate, but it is not shipped, importable from user configuration, documented as a migration helper, used to guess dialect, or accepted as a correctness oracle. Structural labels are persisted harness-assigned logical labels, not object addresses or Promise order. Ticket 25's executable protocol, artifact schema, formulas, validity rules, owner, and independent calculator are design approval evidence. Its built distributions, raw bundle, measured results, retained reports, and independently recalculated verdict are post-implementation acceptance artifacts. This ticket records that impact but does not modify or resolve Ticket 25.

### Final supersession

This final resolution preserves the historical answer only as decision history and supersedes every conflicting or incomplete clause in it. Specifically:

- **Evidence required by final approval** is replaced in full by the two-phase design approval and post-implementation acceptance contract above. Its former items 5 through 10 are post-implementation artifact requirements, not pre-implementation existence requirements.
- The earlier BC-07 metadata shorthand is replaced by the exact regex, frozen ranges, arithmetic, and independent calculator.
- The earlier BC-08 TOC shorthand is replaced by the complete Unicode slug, duplicate-slug, empty-slug, and source-order oracle.
- The absence of a dedicated excerpt value/configuration item is corrected by BC-29 and its exact code-point/ellipsis oracle.
- Every use of `ImmutableDiagnostic`, generic “normalized causes,” optional final diagnostic shape, original mutable Error implication, or implementation-selected normalization is replaced by BC-18/BC-30 and Ticket 23's complete exported `Diagnostic` and `DiagnosticValue` oracle.
- The earlier conceptual prepare example is governed by the exact five-field `PrepareDiagnosticInput` validation and sole sink rules above.
- The earlier cleanup wording is replaced by pointer commit, synchronous install, awaited finite first attempt, immutable operational snapshot, result construction, and return ordering.
- The earlier generic post-commit retry statement is narrowed by exact cleanup outcomes, backlog, later-report immutability, and no hidden mutation after timeout.
- The earlier recovery and cleanup wording is replaced by sealed current/predecessor/backlog recovery, protected manifests, explicit residue handling, and BC-31 reader safety.
- The earlier disposal wording is replaced by the admission ledger, preservation of pre-disposal admitted authority, distinct epoch supersession, exact wait set, and potentially unbounded wait rules.
- Any implication that object identity, Promise completion, wall-clock grace, directory scanning, or best-effort filesystem behavior supplies migration or acceptance truth is superseded.
- The prohibition on public brokers, AST/VFile/seed access, effect/diagnostic transactions, normalizers, registries, generation/reader registries, lease protocols, cleanup handles, publication brokers, instrumentation services, and service locators remains in force.

No new cross-ticket hard contradiction was found. Tickets 20, 23, and 24 are carried without reopening their settled public composition, custom-schema black-box, plugin isolation, VFile seed, effect declaration, immutable diagnostic, generation owner, strict gate, atomic pointer, content-addressed asset, shadow epoch, watch journal, reader retirement, or admission/disposal decisions.

No product code, documentation, examples, tests, benchmark implementation, knowledge file, prototype, report, implementation ticket, specification, or implementation plan was created or changed while resolving this ticket.

## Final concept-convergence resolution

### Authority and supersession

This section is the current and complete Ticket 18 migration contract. Earlier sections remain decision history only. The earlier broad `BC-*` inventory, amendments, mappings, stable-ID claim, and classification rule are superseded and are not compatibility aliases for this contract.

Only canonical `MIG-*` identifiers below identify user migration actions. `NEG-*` identifies negative-surface evidence, and `ACC-*` identifies acceptance-only infrastructure. Neither namespace is a user migration inventory. Tooling, reports, design artifacts, Ticket 11, and future implementation acceptance must not emit or map legacy `BC-*` identifiers.

This resolution:

- consolidates root composition, root methods, wrappers, and dialect selection under one migration group with action-level classification;
- consolidates TOC surface removal and TOC value changes under one migration group with separate detectable and manual actions;
- treats absent `.project()` only as negative-surface evidence;
- removes the revision adapter from user migration;
- keeps prepare-hook migration and general Diagnostic-consumer migration distinct while sharing one diagnostic oracle;
- limits custom effect occurrences to `singleton`, `source-index`, and `key`; and
- defines only the supported external current-plus-direct-predecessor reader behavior, with no managed-reader product seam.

No compatibility getter, proxy, shim, dialect guesser, public broker, migration registry, or product revision adapter is authorized.

### Classification unit

Classification attaches to one indexed migration action or detectable entry point, not to a broad consequence group. A group heading carries no automation class. Every `MIG-*` action has exactly one class:

- **Auto:** a checked-in recipe performs only the exact syntax-proven rewrite in the action.
- **Detect:** tooling reports the entry point and required human decision without editing it. Human work following the report does not add a second Manual class.
- **Manual:** no complete reliable static entry point exists; the user reviews values, ownership, operations, or lifecycle behavior.

This rule is mechanically validated by requiring each canonical action ID to occur exactly once in the index and its `class` field to contain exactly one of `Auto`, `Detect`, or `Manual`.

### Canonical migration action index

| Group                           | Action ID                | Class  | Exact entry point and resulting contract                                                                                                                                                                                                                                                                                                                 | Artifacts                   | Independent oracle                                                                                                                   |
| ------------------------------- | ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Root composition and dialect    | `MIG-ROOT-AUTO`          | Auto   | Rewrite a direct top-level projection call only when the same object literal contains exactly one direct unwrapped Markdown or MDX root and all copied options are recursively JSON-like literals. Emit the corresponding inline root method without introducing a binding or changing evaluation.                                                       | DOC, TOOL, SURFACE          | Positive fixtures rewrite byte-for-byte to the final root call; every excluded syntax is unchanged.                                  |
| Root composition and dialect    | `MIG-ROOT-DETECT`        | Detect | Report every top-level projection form outside the Auto boundary, including orphan, ambiguous, named-root, wrapped-root, dynamic/plugin-option, alias, computed, spread, factory, union, and lazy forms. Make no edit. Require an explicit unwrapped `s.markdown()` or `s.mdx()` root; wrappers remain on the primary field.                             | DOC, TOOL, SURFACE          | Every negative-boundary fixture is reported and unchanged; no dialect is guessed.                                                    |
| Selected input                  | `MIG-INPUT`              | Manual | Review explicit/fallback behavior. Every primary and projection selects `explicit string ?? file.content`; missing input or exact `''` produces the field-local empty-content issue with zero derivation demand.                                                                                                                                         | DOC, PROJ                   | Both dialects cover explicit, fallback, empty, whitespace, and non-empty no-visible-text values and counters.                        |
| Metadata                        | `MIG-METADATA`           | Manual | Revalidate metadata against dialect-aware normalized static visible text and the fixed Ticket 20 regex, ranges, `0.56`, `265`, and `Math.round` oracle.                                                                                                                                                                                                  | DOC, PROJ                   | Test-owned metadata calculator matches every boundary fixture without candidate or pre-1.0 helpers.                                  |
| TOC surface and values          | `MIG-TOC-SURFACE`        | Detect | Report `TocOptions`, `original`, and every argument to `toc`. The supported result is `root.toc()` with no argument; document rewriting remains user-owned.                                                                                                                                                                                              | DOC, TOOL, SURFACE          | Declarations/exports contain no removed surface; tooling reports and does not edit user-owned rewriting.                             |
| TOC surface and values          | `MIG-TOC-VALUE`          | Manual | Revalidate flat source order, static title extraction, Unicode/NFC slugging, empty slugs, and equal unsuffixed duplicate slugs.                                                                                                                                                                                                                          | DOC, PROJ                   | Test-owned TOC calculator matches Markdown/MDX fixtures and never imports candidate helpers.                                         |
| Plugin order                    | `MIG-PLUGIN-ORDER`       | Manual | Review configurations combining global and root-local plugins. Global registrations precede root-local registrations within each phase; order and duplicates are preserved.                                                                                                                                                                              | DOC, PLUGIN                 | Controlled plugin trace proves exact invocation sequence and multiplicity.                                                           |
| Plugin phases                   | `MIG-PLUGIN-PHASES`      | Manual | Review parser extensions and transformers. Parser participation affects pristine parsing/profile identity; returned remark, rehype, and recma transformers do not run for static projections.                                                                                                                                                            | DOC, PLUGIN                 | Adapter counters cross-check parser values and zero static-transform calls.                                                          |
| Plugin concurrency              | `MIG-PLUGIN-CONCURRENCY` | Manual | Review stateful plugins for concurrent records and demands. Closure/global state, direct I/O, randomness, external effects, and global ordering remain plugin-owned.                                                                                                                                                                                     | DOC, PLUGIN                 | Controlled concurrent fixtures preserve per-record values while declaring external state outside rollback.                           |
| VFile continuity                | `MIG-VFILE`              | Manual | Review code relying on parse-to-branch object identity. Supported parse-time state crosses by value; every transforming branch owns a fresh VFile continuous only within that branch.                                                                                                                                                                    | DOC, PLUGIN                 | Mutation probes and phase adapters prove value continuity, same identity within one branch, and sibling isolation.                   |
| Removed ContentFile derivations | `MIG-CONTENTFILE`        | Detect | Report `ContentFile.mdast`, `.hast`, and `.plain` access. Custom schemas select input and own parsing; removed properties remain absent.                                                                                                                                                                                                                 | DOC, TOOL, SURFACE, CUSTOM  | Type/export/reflection evidence plus self-parse examples cover both dialects.                                                        |
| Private imports                 | `MIG-PRIVATE-IMPORT`     | Detect | Report known source, `dist`, core, content, host, generation, epoch, and instrumentation deep imports. Only supported root-package imports remain compatibility surface.                                                                                                                                                                                 | DOC, TOOL, SURFACE          | Source/built declarations, export map, deep-import, own-key, and reflection reports agree.                                           |
| Custom ownership                | `MIG-CUSTOM-OWNERSHIP`   | Manual | Review custom schemas depending on private sharing, AST/VFile identity, lifecycle, or cache behavior not exposed by a detectable import. Move parsing, mutation, caching, I/O, and disposal into the custom schema.                                                                                                                                      | DOC, CUSTOM                 | Black-box examples use only Zod input and the eight-field public context.                                                            |
| Builder export                  | `MIG-BUILDER-EXPORT`     | Detect | Report root-package `createBuilder` imports. Replace them with `builder()`, `build()`, or `watch()`; expose no host/runner installation or reset path.                                                                                                                                                                                                   | DOC, TOOL, SURFACE          | Root and built export reports prove removal and supported facade presence.                                                           |
| Effect declaration              | `MIG-EFFECT-DECLARATION` | Detect | Report one-argument `collectEffect` calls, caller-authored system provenance, and unsupported occurrence kinds. Require `{ path, declaration, occurrence }`; public occurrence is only `singleton`, `source-index`, or `key`. Velite supplies owner, collection, source-file, and record provenance but does not claim custom selected-input provenance. | DOC, TOOL, SURFACE, EFFECT  | Ticket 23 declaration validator and forged-provenance fixtures pass; controlled source ranges remain private.                        |
| Effect transaction              | `MIG-EFFECT-TRANSACTION` | Manual | Review reliance on effects from invalid records or uniqueness winners. Invalid records and every uniqueness-conflict participant lose their complete effect set.                                                                                                                                                                                         | DOC, EFFECT                 | Record-atomic and simultaneous symmetric traces preserve diagnostics and commit zero participant effects.                            |
| Prepare channel                 | `MIG-PREPARE-RETURN`     | Detect | Report `PrepareResult.diagnostics` and returned replacement diagnostics. Remove the return branch and use only `addDiagnostic()`.                                                                                                                                                                                                                        | DOC, TOOL, SURFACE, PREPARE | Type/runtime fixtures prove the return channel absent and the sink present.                                                          |
| Prepare channel                 | `MIG-PREPARE-BEHAVIOR`   | Manual | Review mutation, reordering, replacement, downgrade, copied-diagnostic, cause-identity, and late-sink behavior in prepare hooks. Core diagnostics are immutable and the sink is append-only and settlement-scoped.                                                                                                                                       | DOC, PREPARE, DIAG          | `OR-DIAGNOSTIC-V1` plus sink lifecycle, reversed-order, and mutation fixtures.                                                       |
| Strict                          | `MIG-STRICT`             | Manual | Review strict behavior across every Builder/watch operation. Strict runs after prepare finalization and before staging; rejection preserves current truth.                                                                                                                                                                                               | DOC, GEN                    | Full/patch/watch/reload traces show zero staging/pointer change and unchanged current Generation/Publication.                        |
| Prepare suppression             | `MIG-PREPARE-FALSE`      | Manual | Review `prepare(false)`. It suppresses physical publication only after all gates pass, commits logical truth with an empty Publication, and retains the previous Publication as direct predecessor.                                                                                                                                                      | DOC, GEN, OPS               | Generation/Publication values, pointer, predecessor manifest, and empty `written` are cross-checked.                                 |
| Last successful truth           | `MIG-LAST-SUCCESS`       | Manual | Review full, patch, staging, authorization, pointer, and reload failures. Every failure preserves the complete previous successful Generation and Publication.                                                                                                                                                                                           | DOC, GEN                    | Before/after semantic values and persisted manifests remain identical on every failure path.                                         |
| Output layout                   | `MIG-OUTPUT-LAYOUT`      | Manual | Perform explicit clean or a documented one-time migration before first pointer publication. Normal commit never converts an ordinary directory by unlink-then-link.                                                                                                                                                                                      | DOC, OUTPUT                 | Atomic-pointer adapter and first-clean fixtures prove all-old/all-new behavior.                                                      |
| Asset template                  | `MIG-ASSET-TEMPLATE`     | Detect | Report statically configured Velite-managed templates without an adequate hash token. Require a hash-bearing destination or an explicit move outside Velite ownership.                                                                                                                                                                                   | DOC, TOOL, OUTPUT           | Positive/negative template fixtures and content/destination collision oracle.                                                        |
| Asset ownership                 | `MIG-ASSET-OWNERSHIP`    | Manual | Review generated templates and externally managed destinations that static configuration detection cannot classify.                                                                                                                                                                                                                                      | DOC, OUTPUT                 | Manifest/reference ownership and collision fixtures prove the selected boundary.                                                     |
| BuildResult surface             | `MIG-RESULT-SURFACE`     | Detect | Report direct or destructured `BuildResult.diagnostics` handling that assumes one diagnostic channel. Handle immutable `operationalDiagnostics` separately.                                                                                                                                                                                              | DOC, TOOL, SURFACE, OPS     | Public/built types and result own-key fixtures prove two immutable snapshots.                                                        |
| Post-commit operations          | `MIG-POSTCOMMIT`         | Manual | Review code that treats cleanup/logger/reporting failure as uncommitted or expects return before first cleanup. Confirmed pointer commit remains success; one finite first cleanup is awaited before result.                                                                                                                                             | DOC, OPS                    | Pointer, install, cleanup outcomes, operational snapshot, total result, and return sequence.                                         |
| Cancellation                    | `MIG-CANCELLATION`       | Detect | Report `BuildOptions.signal` and `build({ signal })`. Remove them; no public hard-cancellation promise exists.                                                                                                                                                                                                                                           | DOC, TOOL, SURFACE, BUILDER | Declarations and runtime options reject the removed field; lifecycle tests use settle-and-fence semantics.                           |
| Watch and disposal              | `MIG-WATCH`              | Manual | Review readiness, shadow reload, replay checkpoints, epoch supersession, operation admission, awaitable terminal close/disposal, and late side effects.                                                                                                                                                                                                  | DOC, BUILDER                | Controlled state-machine interleavings and adapters prove event coverage, supersession, admission, wait set, and terminality.        |
| Recovery and cleanup            | `MIG-RECOVERY`           | Manual | Review sealed pointer/current/predecessor/backlog recovery, retryable cleanup, unknown residue, and explicit repair/clean.                                                                                                                                                                                                                               | DOC, OPS                    | Cold-start fixtures use only validated persisted metadata and authorize no scan-based deletion.                                      |
| Excerpt option                  | `MIG-EXCERPT-OPTION`     | Detect | Report statically invalid literal `length` values where sound. Supported length is a non-negative safe integer with default `260`.                                                                                                                                                                                                                       | DOC, TOOL, SURFACE, PROJ    | Type/runtime option fixtures cover every literal boundary without coercion.                                                          |
| Excerpt values                  | `MIG-EXCERPT-VALUE`      | Manual | Revalidate Unicode code-point truncation, `trimEnd()`, one `U+2026`, zero length, and no-visible-text behavior.                                                                                                                                                                                                                                          | DOC, PROJ                   | Test-owned excerpt calculator matches every boundary and never imports candidate helpers.                                            |
| Diagnostic surface              | `MIG-DIAGNOSTIC-SURFACE` | Detect | Report removed or changed `Diagnostic` fields/types and assumptions about optional stage, closed code unions, host-specific tags, stack, or original causes.                                                                                                                                                                                             | DOC, TOOL, SURFACE, DIAG    | `OR-DIAGNOSTIC-V1` plus source/built declarations, own keys, and reflection.                                                         |
| Diagnostic values               | `MIG-DIAGNOSTIC-VALUE`   | Manual | Review every general Diagnostic consumer depending on original object identity, mutable nested values, host-object methods, stack, insertion order, or old context/cause structure.                                                                                                                                                                      | DOC, DIAG                   | `OR-DIAGNOSTIC-V1` normalizes the narrow closed domain, compares canonically, detaches recursively, and proves runtime immutability. |
| External readers                | `MIG-EXTERNAL-READER`    | Manual | Review direct filesystem readers. A Publication resolved while current remains protected through at most one successful pointer advance and must be reacquired before the second; no duration, indefinite path, opened-handle, acquisition protocol, lease, pin, or registry guarantee exists.                                                           | DOC, OPS                    | Current/predecessor manifests, pointer advances, shared-blob references, recovery, and explicit-clean fixtures.                      |

### Shared diagnostic oracle

`MIG-PREPARE-RETURN` and `MIG-PREPARE-BEHAVIOR` apply specifically to prepare-hook authors. `MIG-DIAGNOSTIC-SURFACE` and `MIG-DIAGNOSTIC-VALUE` apply to all Diagnostic consumers, including build results, rejected public errors, prepare, and operational results. They remain separate migration consequences and share one independent oracle, `OR-DIAGNOSTIC-V1`.

`OR-DIAGNOSTIC-V1` is exactly Ticket 23's final public TypeScript surface, normalization, equality, ordering, detachment, immutability, and prepare-input oracle. It includes complete top-level provenance; finite JSON-like scalars; explicit undefined, exceptional-number, bigint, Error, circular, and one generic opaque representation; detached arrays; sorted records; no stack or original reference; and no host taxonomy or dedicated Proxy detector.

### Negative and acceptance-only inventories

`NEG-PROJECTION` proves `.project()` absent from source and built declarations, root/runtime exports, export map, own keys, and reflection. It has no migration recipe, action ID, renamed helper, or compatibility surface because `.project()` was never part of the final supported 1.0 contract.

`ACC-REVISION-ADAPTER` identifies Ticket 25's revision-specific harness adapter. It is acceptance infrastructure only. It has no `MIG-*` action, is not user importable, is not documentation guidance, and is not a compatibility shim, codemod, dialect guesser, or candidate correctness oracle.

### Artifact ownership

Every artifact kind has exactly one accountable owner. Action rows may require multiple artifact kinds, but do not create duplicate semantic authorities.

| Code    | Artifact kinds                                                                                    | Sole accountable owner                          |
| ------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| DOC     | Migration documentation, before/after examples, and manual scenarios                              | Migration documentation acceptance              |
| TOOL    | Auto recipes, Detect rules, and positive/negative boundary fixtures                               | Migration tooling acceptance                    |
| SURFACE | Source/built declarations, exports, export map, deep imports, own keys, and reflection            | Public interface acceptance                     |
| PROJ    | Markdown/MDX semantic fixtures and independent excerpt/TOC/metadata calculators                   | Projection semantic acceptance                  |
| PLUGIN  | Plugin order/phase/concurrency and VFile continuity/isolation fixtures                            | Plugin and content-kernel acceptance            |
| CUSTOM  | Custom self-parse and ownership examples/tests                                                    | Custom-schema acceptance                        |
| EFFECT  | Effect declaration, identity, record-atomic, and uniqueness traces                                | Effect transaction acceptance                   |
| PREPARE | Prepare return, sink, conflict, closure, and late-call fixtures                                   | Prepare-channel acceptance                      |
| DIAG    | Diagnostic declarations, independent normalizer/comparator, detachment, and mutation probes       | Diagnostic model acceptance                     |
| GEN     | Strict, empty-Publication, and last-successful Generation traces                                  | Generation publication acceptance               |
| OUTPUT  | Atomic pointer, first clean, layout, asset identity, and collision evidence                       | Output and asset publication acceptance         |
| OPS     | Commit/result order, cleanup, recovery, external-reader, and manifest-derived protection evidence | Publication lifecycle and operations acceptance |
| BUILDER | Cancellation removal, watch, admission, supersession, and disposal evidence                       | Builder/watch lifecycle acceptance              |

The design index schema uses three separate fields:

```text
migrationActionIds: MIG-* only
negativeSurfaceIds: NEG-* only
acceptanceArtifactIds: ACC-* only
```

Mixing these namespaces is invalid.

### Evidence phase and acceptance

Before implementation, migration design acceptance validates this index for unique action IDs, exactly one class per action, exact entry point, before/after consequence, mapped artifact kinds, sole owner per artifact kind, independent oracle, and failure condition. It does not require fabricated implementation artifacts.

After implementation, every action must have its mapped documentation/tooling/type/runtime/semantic/lifecycle evidence. Auto recipes must remain inside their exact positive boundary. Detect rules must report and never edit. Manual actions require the stated before/after scenarios and independent oracle. Missing mappings, duplicate IDs, multi-class actions, namespace mixing, dialect guessing, compatibility behavior, candidate-private correctness, or contradictory old guidance fail acceptance.

### Cross-ticket effect

Ticket 12 and the bug-disposition summary must reference `MIG-EFFECT-TRANSACTION`. Ticket 23 is the sole diagnostic/effect surface and oracle authority. Ticket 24 is the sole publication/lifecycle authority. Ticket 25 maps these action-level consequences to its concrete EvidenceProtocol but keeps acceptance-only infrastructure outside this migration inventory. Ticket 11 and the map must summarize canonical action-level classification rather than a broad legacy inventory.
