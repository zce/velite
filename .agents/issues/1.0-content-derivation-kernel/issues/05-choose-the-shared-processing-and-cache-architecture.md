# Choose the shared processing and cache architecture

Status: resolved
Origin: #392 (deleted from GitHub)
Created: 2026-07-15T12:06:44Z
Type: prototype

---

## Question

Which internal architecture should coordinate parsing, transformations, compilation, and reusable derived artifacts so that representative workloads avoid redundant work without violating the agreed semantic invariants?

## Answer

### Decision

Use an explicitly assembled, record-scoped **Content Artifact Broker**: a demand-driven content derivation module whose guaranteed shared cache contains only matching pristine parses. It is created as part of the pipeline epoch, opened once for each record validation, and released when that record's asynchronous schema validation completes.

The broker is the seam between schema-rooted projection requests and dialect-specific parsing/processing. It does not join the incremental engine graph, live in `SessionStore`, or hide coordination state inside `ContentFile`. It does not build a general transform-prefix DAG.

The intended small interface is conceptually:

```ts
interface ContentArtifactsFactory {
  open(scope: ContentRecordScope): ContentArtifacts
}

interface ContentArtifacts {
  demand<T>(request: ContentArtifactRequest<T>): Promise<ContentBranchOutcome<T>>
}
```

The concrete names and request identity representation may change in later tickets. The important interface facts are:

- a request fully describes the selected Content Input, resolved immutable dialect/profile, and demanded projection;
- `demand()` is the only operation schemas need;
- parser selection, compatibility checks, in-flight coalescing, pristine ownership, branch cloning, VFile creation, and processor execution remain behind the interface;
- request descriptors are controlled content recipes, not arbitrary caller-supplied cache keys plus compute callbacks.

### Assembly and ownership

`createPipeline()` is the composition root for the broker factory and its internal Markdown and MDX dialect adapters. The validate derivation receives the factory explicitly. For each loaded record, validate opens a fresh broker before `safeParseAsync()` and binds only a narrow record-scoped `content(request)` capability closure into `SchemaContext`, analogous in shape to the existing record-bound asset capability.

The closure does not expose the broker object, cache inspection, invalidation, engine, processor registry, or lifecycle controls. This keeps Zod's unavoidable ambient seam narrow without turning `context()` into a general service locator. Schema roots contain only immutable dialect/profile and projection descriptions; they never retain a runtime broker.

Ownership is:

| State                                                | Owner                     | Lifetime                      |
| ---------------------------------------------------- | ------------------------- | ----------------------------- |
| Dialect adapters and broker factory                  | pipeline composition root | config/pipeline epoch         |
| Root profile and projection descriptors              | configured schemas        | config epoch                  |
| Parse slots and in-flight promises                   | record broker             | one record validation         |
| Pristine AST and parse-time VFile snapshot           | matching parse slot       | record broker lifetime        |
| Transform AST clone, VFile, diagnostics, and effects | one demanded branch       | one branch execution          |
| Final validation commit state                        | validate boundary         | one record validation attempt |

This scope deliberately provides sibling sharing without introducing a second incremental invalidation system. The existing engine already avoids revalidating unchanged sources. Exact cache keys, retention policy, and possible future reuse beyond one record remain later decisions.

### Demand and sharing semantics

Each root schema or projection independently selects its explicit string input or file-body fallback and submits a request. It never reads a sibling result or waits for a sibling schema. Separately created but equivalent roots can share because root object identity is absent from request identity.

The broker maintains a parse slot for each compatible Content Input and parse profile. It installs the in-flight promise before starting parse, so concurrent sibling demands await the same parse regardless of start or completion order. Text, dialect, origin semantics, or parse-affecting profile differences select different slots. A rejected parse is retained as an immutable failure outcome for the rest of the record scope, so matching later demands do not schedule a second parse. A failed transform branch does not invalidate or contaminate the successful pristine parse or any sibling branch.

Only the pristine parse has a mandatory memoization contract. Rendering, MDX compilation/minification, plugin transforms, and general projection prefixes are not cached by default. A later design may add a named immutable static artifact when it is proven pure and materially valuable, but it must not turn the broker into a speculative transform-prefix DAG.

This is demand-driven:

```text
projection request
  -> matching pristine parse (shared)
  -> requested static projection OR isolated transform branch
```

Consequently, `s.mdx().toc()` performs an MDX-aware parse and static TOC projection only. It does not create or execute the root's primary compile/minify pipeline. Markdown and MDX primary projections likewise execute only when directly demanded.

### Parsers, processors, ASTs, and VFiles

The broker implementation owns two internal dialect adapters, one for Markdown and one for MDX. They are real internal adapters because parsing and primary processing differ by dialect, but their AST representation is not a stable public extension seam.

Each adapter:

- creates the dialect-correct parser from the resolved parse profile;
- returns an opaque pristine artifact containing the pristine tree and enough immutable VFile state to create branches;
- allows only trusted built-in static projections to inspect the pristine tree without mutation;
- clones the AST and creates a fresh VFile for every branch that runs Unified, MDX compilation, or another transforming processor;
- creates branch-local processor execution rather than assuming arbitrary plugin closures or processor instances are concurrently reusable.

The pristine AST and VFile are never passed directly to ordinary plugins or returned from the module. A branch receives its own AST clone, `file.data`, `file.messages`, path/history state, and other mutable VFile state. Branch mutation, rejection, and asynchronous completion therefore cannot alter the pristine parse or another branch. Processor concurrency remains subject to the later plugin contract; tree and VFile isolation alone does not make a stateful plugin safe.

### Diagnostics and effects

Every demand returns a branch-local outcome containing its value or failure plus its diagnostics and declarative effects. Processors and plugins must not append directly to a shared record array while running. The schema adapter maps the local outcome into its Zod result, while validate retains ownership of the record-level commit boundary.

This decision requires locality and stable association with the requesting projection, but intentionally does not decide canonical ordering, commit/discard rules, deduplication, or effect identity. Those belong to the dedicated effects decision.

### Alternatives considered

1. **Record-scoped demand-driven module.** This was the strongest base model and is adopted in the broker form. The broker deepens it to one `demand(request)` interface and limits its internal graph to the evidenced shared parse stem.
2. **Directly extend the existing engine derivation graph.** The engine already provides in-flight coalescing and incremental invalidation, but storing pristine artifacts there would require stable keys and hashes for plugin-bearing profiles, ASTs, and VFiles; safe encapsulation against post-hash mutation; content-specific GC; and dynamic projection naming. Those costs are unnecessary for sharing work among siblings within one validation, while assets can continue to enter the engine through the existing validate context.
3. **Coordinate through `SchemaContext` or `ContentFile` caches.** The current lazy `ContentFile.mdast/hast/plain` cache is simple but cannot correctly represent explicit selected text, MDX-aware parsing, or parse profiles. Expanding it would combine metadata with lifecycle-bearing coordination state. Putting a cache or derivation registry directly on `SchemaContext` would broaden the intentional ambient exception toward a service locator. The selected design passes only a narrow bound capability through that seam and keeps state in an explicitly created module.
4. **Record-scoped artifact broker with a full internal artifact graph.** Caching final projections or arbitrary transform prefixes could theoretically share more work, but plugin mutation, effect identity, failure semantics, and profile identity make this substantially more complex. The current measurements show two parses per combined document, while MDX compile/minify is the dominant cost; they do not justify a general prefix DAG. The selected broker therefore guarantees only parse-stem sharing and lazy isolated projections.

### Evidence

The throwaway prototype and report are in `.agents/sessions/20260717-1806-content-architecture/`. The executable prototype verifies that:

- concurrent matching sibling requests invoke parse once;
- different text, dialect, and parse profiles do not share;
- projection-only requests do not execute a primary pipeline;
- mutating transform branches cannot alter the pristine tree or each other;
- branch VFiles are independent;
- matching rejected requests share one failed parse while unrelated requests succeed; and
- asynchronous completion order does not change request/result association.

The prototype passes with `node .agents/sessions/20260717-1806-content-architecture/prototype.mjs`. No product code was modified.
