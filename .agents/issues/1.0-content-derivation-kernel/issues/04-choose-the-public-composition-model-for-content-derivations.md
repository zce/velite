# Choose the public composition model for content derivations

Status: resolved
Origin: #391 (deleted from GitHub)
Created: 2026-07-15T12:06:41Z
Type: prototype

---

## Question

Which 1.0 public API model best balances simplicity, explicitness, type safety, extensibility, and efficient sharing: independent schemas with implicit coordination, an explicit content pipeline with projections, a unified schema producing multiple results, or another concrete model?

## Answer

### Decision

Use a **schema-rooted derivation family**. `s.markdown(options)` and `s.mdx(options)` remain directly usable Zod-compatible schemas for their primary result, and each direct return value also acts as an immutable dialect and processing-profile root from which sibling projection schemas are created.

```ts
const content = s.mdx({ remarkPlugins: [...] })

const posts = defineCollection({
  pattern: 'posts/**/*.mdx',
  schema: s.object({
    title: s.string(),
    content,
    toc: content.toc(),
    excerpt: content.excerpt({ length: 160 })
  })
})
```

`toc()` and `excerpt()` are projections common to both dialects, but the public methods are exposed from the Markdown or MDX root so their dialect and profile are never inferred from sibling presence or execution order. The top-level `s.toc()` and `s.excerpt()` forms are removed in 1.0. A projection needed without the primary result remains expressible, for example `toc: s.mdx().toc()`.

The model reserves a high-level extension point on the root for custom projections, illustrated by `content.project(readingTime())`. The exact name, recipe capabilities, identity, effects, and authoring contract remain the responsibility of the custom-schema extension decision; this ticket does not expose an AST or freeze that contract.

### Execution semantics

- The root and every projection method return independent schemas. A projection never waits for the primary sibling, reads its result, or depends on object-key order.
- The root carries an immutable dialect/configuration profile. Its projection methods inherit that profile, not the runtime value selected by another field.
- Every schema independently selects its Content Input: an explicit string field value takes precedence; the current record's file body is the fallback. Equal selected text and profile may share work; different explicit values must not.
- Each schema demands artifacts from the derivation kernel. Concurrent requests with the same Content Input and resolved parse profile coalesce through the same in-flight parse request, regardless of which sibling starts first.
- The conditional performance contract is at most one pristine parse for matching Content Input/profile requests within the kernel's eventual cache scope. It is not one parse per file unconditionally: different text, dialect, or parse-affecting configuration correctly requires separate parsing.
- Shared TOC and excerpt recipes read the dialect-correct pristine tree. An MDX root therefore produces static TOC/excerpt projections from an MDX-aware parse rather than reparsing as Markdown. Transforming render/compile branches receive isolated AST and VFile clones under the previously agreed invariants.
- A root's projection methods are guaranteed on the direct `s.markdown()` / `s.mdx()` return value. Ordinary Zod wrappers such as `.optional()`, `.transform()`, and `.pipe()` may return a plain wrapped schema and are not required to preserve the family methods; callers create sibling projections from the unwrapped root.

### Root equivalence and identity

Reusing one root is a configuration and readability convenience, not a prerequisite for semantic equivalence or shared work. These forms have the same observable behavior and sharing eligibility when their selected inputs and effective profiles match:

```ts
const content = s.mdx()

s.object({
  content,
  toc: content.toc(),
  excerpt: content.excerpt()
})
```

```ts
s.object({
  content: s.mdx(),
  toc: s.mdx().toc(),
  excerpt: s.mdx().excerpt()
})
```

- A root object's JavaScript reference identity must never be part of Content Input, parse-profile, derivation, or cache identity.
- Equivalent independently-created roots must resolve to equivalent profiles. Their matching projection requests remain eligible for the same in-flight and cached pristine parse.
- Creating `s.mdx().toc()` or `s.markdown().excerpt()` constructs only the selected projection schema. It must not execute the discarded root's primary compile or render projection.
- Reusing a named root remains recommended when several projections share non-default options because it avoids configuration repetition and makes intentional profile matching visible.
- Different selected text or effective parse-affecting options remain different requests even if they came from the same root. Conversely, matching requests remain shareable even if they came from different root instances.
- The eventual profile-identity design must handle plugin and option identity conservatively without falling back to root-instance identity. Exact normalization and cache-lifetime mechanics remain later architecture decisions.

### Why this model

- It preserves the concise and familiar `content: s.markdown()` / `content: s.mdx()` primary-result interface.
- It makes the dialect and shared processing profile explicit once without adding a separate content-family declaration.
- It preserves arbitrary output field names, selective execution, ordinary Zod object composition, and precise per-field output inference.
- It solves sibling concurrency in the kernel rather than imposing execution ordering on Zod fields.
- It places common projection behavior behind a dialect-correct root while keeping Markdown-specific rendering and MDX-specific compilation as the root schemas' primary projections.

### Rejected alternatives

- Independent top-level contextual schemas have the shortest call site, and a demand-driven kernel could coordinate them, but TOC/excerpt would still need hidden dialect/profile resolution and locally configured plugins would be easy to misunderstand.
- A separate `s.content.markdown()` / `s.content.mdx()` family is semantically clean but adds ceremony and exposes coordination as a caller concern even though the primary schemas already establish the required profile.
- A unified schema returning all selected results forces a nested output shape, couples otherwise independent result and failure semantics, and makes open-ended custom results harder to type and compose.
- A scoped shape-fragment DSL such as `...s.content.mdx(body => ({ ... }))` avoids the root's dual role but introduces spread/DSL noise and separate simple-versus-combined modes without enough additional leverage.

### Prototype evidence

The throwaway call-site and type prototype is in `.agents/sessions/20260717-1642-public-content-api/`. All four alternatives preserve precise types in the prototype; the schema-rooted model uniquely preserves the direct primary schema while explicitly carrying the dialect/profile to sibling projections. Its strict TypeScript check and JavaScript syntax checks pass. No product code was modified.
