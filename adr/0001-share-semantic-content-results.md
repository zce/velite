# Share semantic results of explicitly defined content executions

Status: accepted target architecture for Velite 1.0, 2026-09-30. This decision does not claim that the current implementation has been migrated or approved for release.

Velite will separate Content Definitions from ordinary Zod result schemas. Reusing a definition with the same selected input in one record coordinates one exclusively owned processing execution; separately created definitions remain independent. Share detached semantic results rather than pristine ASTs or reconstructed plugin state, because ordinary parser/transformer closures and VFile replacement cannot be preserved reliably by general profile comparison and seed copying.

## Consequences

- Markdown and MDX share semantic contracts and record orchestration, not a mandatory common parser or AST. Dialect adapters own processor assembly and dependency compatibility.
- Fixed parse, complete-transform, and emit demand levels reuse in-flight and completed work. Bounded source/navigation snapshots preserve late selections; laziness avoids unrequested expensive stages, not every traversal.
- Source Analysis remains pre-transform. Navigation TOC uses statically determined transformed headings and actual anchors; downstream code plugins and runtime heading components must preserve those navigation semantics.
- The current tree/file and plugin-private state remain owned by the execution. Follow legal callback replacements; do not clone, expose, or freeze arbitrary plugin state to establish sharing.
- Failures affect dependent stages without automatic retry. Controlled stage effects become eligible once after success, are discarded on stage failure, and commit only through valid-record/build transactions. Direct plugin I/O is not rollbackable.
- Preserve native Zod composition. Wrappers are not a scheduler or an implicit selected-body policy; explicit input composition expresses conditional derivation.
- No general projection protocol, public content broker, public pristine AST/VFile, processor registry, cache controls, or arbitrary transform-prefix graph is introduced.

## Scope and verification

This supersedes the earlier pristine-parse/profile-equivalence and hybrid-root direction for content processing, not unrelated build/publication decisions. Historical tracker clauses, implementation guidance, and product code require deliberate migration before implementation proceeds; they have not been silently rewritten.

A small real-dependency prototype supports the phase-continuation mechanism. Production effect scopes, diagnostic handling, value detachment, recursive-demand guards, disposal, complete heading/text oracles, and representative performance still require verification. Exact export spellings and generated-anchor value rules belong to the subsequent concrete interface contract, not to this architectural decision.
