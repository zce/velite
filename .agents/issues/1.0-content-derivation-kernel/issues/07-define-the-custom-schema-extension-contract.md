# Define the custom schema extension contract

Status: resolved
Origin: #394 (deleted from GitHub)
Created: 2026-07-15T12:06:48Z
Type: grilling

---

## Question

Which stable high-level capabilities should custom schemas receive to request, contribute, or reuse content derivations without exposing unstable implementation details or creating hidden coordination?

## Answer

### Decision

Velite 1.0 will not expose a general custom content-projection contract. The schema-root placeholder `content.project(...)` is removed from the 1.0 design, and Velite will not add `defineContentProjection(...)`, a public projection recipe object, or a record-scoped public content-demand capability.

`s.markdown()` and `s.mdx()` remain immutable dialect/profile roots. Their primary schemas and Velite-owned sibling methods such as `.toc()` and `.excerpt()` create controlled internal projection requests. Those requests participate in the record-scoped Content Artifact Broker. The descriptors, static-versus-transforming classification, and result adapters for those requests remain Velite implementation details rather than a user-authorable protocol.

Ordinary `defineSchema(...)` schemas, wrapped Zod schemas, transforms, and refinements remain independent black boxes. They retain exact Zod inference because `defineSchema` remains an identity helper over the supplied schema; no second output declaration or projection-specific type carrier is introduced. A black-box schema is never identified as shareable by object identity, callback inspection, branding, naming, or its use of `context()`.

This deliberately gives up custom AST-based parse sharing in 1.0. The evidenced benefit of a general recipe contract is only reuse of the pristine parse stem: projection results and transform prefixes are not shared, and every transforming demand still requires an isolated branch. That benefit does not justify stabilizing a second content model, output protocol, dialect-generic recipe type, plugin result channel, and effects adapter before concrete third-party workloads demonstrate the need.

### Custom schema contract

A custom schema continues to receive exactly the normal Zod value and callback context plus the existing ambient `context()` contract:

- Its input is the value selected by normal Zod composition. A file-derived custom schema may explicitly implement the established `value ?? context().file.content` fallback, but Velite does not infer this on its behalf.
- It may read the existing project, file, and record source context and use the existing asset, diagnostic, store, and declarative-effect facilities under their ordinary custom-schema semantics.
- It may be synchronous or asynchronous and reports validation diagnostics through Zod. Existing declarative effects remain available through `SchemaContext`; their commit, ordering, and deduplication semantics remain for the dedicated effects decision.
- It owns any parser, AST, VFile, processor, cache, mutable closure state, I/O, and external side effects that it creates. Velite does not coordinate or share those resources through the Content Artifact Broker.
- Dialect applicability is the custom schema author's contract. A reusable schema may expose separate Markdown and MDX factories or accept an explicit dialect option, but Velite adds no recipe-level dialect discriminator or compile-time root compatibility check.
- Its configuration and identity are ordinary JavaScript and Zod configuration and identity. They do not participate in broker identity. Authors test it as an ordinary schema, with the same schema-context harness needed by any context-dependent schema; tests do not fake a broker, cache key, lifecycle, engine, or registry.

`defineSchema(...)` therefore means "a reusable Zod schema with ordinary black-box execution." A shareable content projection means "a Velite-owned request descriptor exposed through a method on a Markdown/MDX root." There is no public conversion from the former into the latter in 1.0.

### Pristine representation and branch safety

Custom static code receives no pristine representation. This is the concrete runtime-safety rule: no canonical AST reference, nominally readonly AST, AST-shaped proxy, defensive AST snapshot, VFile, or processor crosses the public custom-schema seam.

The rejected alternatives have materially different costs:

- TypeScript `readonly` or `DeepReadonly` does not prevent mutation at runtime, through casts, aliases, visitors, or nested mutable values, so it cannot protect the canonical tree.
- A proxy or node facade can prevent direct writes only by defining and maintaining another observable traversal and node model. It adds per-access behavior and effectively stabilizes a second AST interface.
- Cloning and recursively freezing a tree protects the canonical tree, but makes the clone's AST shape a de facto public contract, pays whole-tree allocation and traversal costs, and needs rules for plugin-added values that are cyclic, stateful, shared, or not cloneable. Freezing the canonical tree itself can also freeze values owned by parser extensions and constrain future ownership or copy-on-write implementations.
- A restricted query interface returning immutable text, headings, references, and similar DTOs is safe and deep, but its vocabulary would itself be a new public content model. Existing `.toc()` and `.excerpt()` already provide the evidenced high-value semantic projections; no broader query model is justified for 1.0.

When arbitrary custom code needs an AST, it must create and own that representation inside its black-box schema. Its mutation cannot affect the broker's pristine artifact because the two never share an object. Ordinary Unified plugins configured on a Markdown or MDX root continue to run with their normal semantics on the root's transforming primary branch, whose observable AST/VFile state is independent as previously decided. Velite does not provide a separate custom projection branch merely to extract another result.

### Broker boundary

Only Velite-controlled root and sibling descriptors can demand content artifacts. Custom schemas cannot access request constructors, cache keys, parse slots, cache inspection, invalidation, broker lifecycle, engine nodes, dialect adapters, processor registries, or a generic `demand()` operation. The internal record-bound closure described by the broker decision remains an adapter used by Velite's schema implementations, not a new public field on `SchemaContext`.

Root reference identity remains irrelevant: equivalent roots and matching Velite-owned requests can share according to selected Content Input and effective dialect/profile. A custom schema's function, object, schema, or configuration identity never makes it eligible for that sharing.

### Alternatives considered

1. **Schema-rooted declarative recipe**, such as `content.project(readingTime())`. This best preserves explicit dialect/profile inheritance and could provide precise output inference, but a safe general form requires a recipe brand, dialect constraints, output typing or validation, static queries, transform result transport, diagnostics/effects adaptation, and identity rules. It is rejected because this public protocol is larger than the parse-only reuse it unlocks.
2. **A record-scoped content capability on `SchemaContext`**. A correct demand would still need selected input, profile, a controlled projection descriptor, and outcome mapping. Exposing those makes every caller reproduce the root adapter, leaks coordination into arbitrary Zod transforms, and turns the intentional ambient seam toward a service locator. A capability without those parameters would rely on hidden sibling or execution-order inference and would be incorrect.
3. **Direct AST/VFile or processor access**. This is the most flexible option but exposes representation, phase, ownership, cloning, processor-freeze, and lifecycle knowledge. Readonly pristine access is not runtime-safe; mutable access must allocate an isolated branch and still stabilizes ecosystem types as Velite's interface. Direct processor access additionally makes parser/compiler assembly and scheduling observable. It is rejected as the shallowest interface.

The selected contract is smaller than all three: callers declare ordinary validation/transformation with Zod, or select the finite Velite-owned projections exposed by a dialect/profile root. They do not learn the broker, parser, clone, VFile, or scheduling mechanism.

### Reconsideration threshold

A future version may reopen custom shareable projections only with concrete third-party use cases showing that repeated custom AST parsing is a material cost and that the same small semantic interface serves multiple projections. That would be a new design decision, not an undocumented extension of `defineSchema`. No prototype is needed for the 1.0 decision because it introduces no new TypeScript surface; the previously proposed dialect and output inference machinery is intentionally absent.
