# Define the semantic invariants of shared content derivation

Status: resolved
Origin: #390 (deleted from GitHub)
Created: 2026-07-15T12:06:39Z
Type: grilling

---

## Question

What source identity, result equivalence, ordering, determinism, mutation-isolation, and correctness invariants must every shared content derivation design preserve across built-in and custom schemas?

## Answer

### Content input identity

A **Content Input** is the semantic tuple of:

- the current record identity and source path;
- the selected source text;
- the declared `Markdown` or `MDX` dialect; and
- every option or syntax extension that affects parsing, including whether GFM is enabled.

An explicit string schema input always supplies the selected source text; the current file body is only the fallback when no explicit value is supplied. The explicit text retains the current record and source path as its origin context. A derivation must never use an AST parsed from the fallback file body when explicit text was selected.

Input selection and derivation are separate concerns. After selecting the explicit text or file-body fallback, each schema applies its normal derivation semantics: TOC extracts headings, excerpt extracts static visible text and truncates it, Markdown renders HTML, and MDX compiles code. Only a schema whose defined result is raw source text returns the selected text unchanged.

Two derivations may share a pristine parse tree only when their selected text, dialect, and complete parse-affecting configuration match. Markdown and MDX are distinct dialects. MDX content must be parsed with an MDX-aware parser rather than treated as degraded Markdown for TOC or excerpt extraction. Record identity and path remain semantic context even when text is equal; a later cache design may content-address proven path-independent work without redefining Content Input identity.

### Observable equivalence

Shared execution must be observationally equivalent to the specified isolated execution of each derivation for the same Content Input, configuration, and dependency versions. It must preserve:

- the same schema value, with byte-identical string results;
- the same diagnostics and declarative effects;
- the same success or failure boundary; and
- the same externally visible ordering.

Internal step counts, cache hits, scheduling, and object identity are not observable requirements. Known bugs in the current implementation are not an equivalence baseline.

### Ordering and determinism

For fixed inputs, configuration, and dependency versions, repeated builds must produce byte-stable values and outputs. Source-derived results preserve source syntax order, including heading order in a TOC. Collection items, diagnostics, and effects use their specified canonical order, never asynchronous completion order, cache-hit order, or sibling-schema evaluation order. Concurrent work must be stably merged at its commit boundary; the exact canonical keys belong to the tickets that define those result types.

### Mutation and asynchronous isolation

The established reuse boundary remains mandatory: only a dialect- and parse-configuration-matched pristine parse tree is shareable. Every transforming branch receives its own cloned AST and VFile. Branch mutations, `file.data`, `file.messages`, diagnostics, and failures must not leak into another branch. Processor concurrency safety remains dependent on the participating plugins and is not implied by this decision.

Asynchronous sibling schemas are independent derivations that may start and finish in any order. A sibling must not depend on another sibling running first, mutating shared AST/VFile state, or publishing an implicit intermediate result. Siblings for the same Content Input may await the same read-only pristine parse result, but each transforming branch remains isolated. A sibling's cancellation or failure must not contaminate another sibling; validated values and effects are committed or discarded at the record-validation boundary. Promise coalescing, cancellation mechanics, and cache lifetime remain later architecture decisions.

### Static MDX projections

MDX TOC and excerpt are static source projections over the pristine MDX AST. They never execute or evaluate JavaScript expressions, ESM, JSX components, or rendering plugins.

- TOC collects Markdown heading nodes in source order. A heading title concatenates statically known visible descendants, including literal text, static inline code, and static text children inside JSX. Expressions, JSX names, and JSX attributes contribute no text. A heading with no static title is omitted.
- Excerpt collects statically known visible body text in source order, applies deterministic whitespace normalization, and then truncates it. ESM, expressions, JSX names, and JSX attributes contribute no text; static JSX text children do.

Neither projection observes mutations made by rendering or compilation branches.

### Built-in and custom schemas

Every built-in or custom schema that participates in shared content derivation obeys the same Content Input, equivalence, determinism, ordering, and isolation invariants. The kernel must not infer that an arbitrary custom Zod transform is shareable merely because its inputs appear equal. A custom schema whose eligibility cannot be established executes as an independent black box.

This decision constrains, but does not choose, the later public composition API, cache architecture, plugin eligibility contract, custom extension contract, or concrete implementation.
