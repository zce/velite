# Design the 1.0 shared content derivation kernel

Status: open
Origin: #387 (deleted from GitHub)
Created: 2026-07-15T12:06:06Z

---

## Destination

Produce an implementation-ready design for the Velite 1.0 content derivation kernel: its public API, processing and sharing semantics, extension and plugin boundaries, side-effect model, and measurable correctness and performance criteria. The design may replace current architecture and APIs where justified, but this map stops before implementation.

## Notes

Domain: deriving Markdown/MDX outputs such as compiled code, HTML, excerpts, and tables of contents from the same content source without redundant work.

Every decision session should consult `/grilling` and `/domain-modeling`; use `/prototype` for concrete API or pipeline alternatives and `/research` for facts outside the repository.

Correctness and predictable semantics are hard constraints; optimize representative end-to-end build performance beneath them. Keep custom schemas supported through the existing Zod and `SchemaContext` boundary, but limit shared broker derivations in 1.0 to Velite-owned root and sibling projections; expose neither a general custom projection protocol nor a public AST. Keep normal Unified/remark/rehype and `@mdx-js/mdx` plugins usable, while explicitly defining which work cannot safely be shared. Public API shape is open. Any part of the core may change when directly justified by correctness, performance, simplicity, or extensibility of content derivation. Breaking changes are allowed before 1.0.

## Decisions so far

- [Establish the safe reuse boundaries of Unified and MDX processors](issues/01-establish-the-safe-reuse-boundaries-of-unified-and-mdx-proce.md) - Reuse only format/config-matched pristine parse trees; clone tree and VFile per transforming branch, with processor concurrency remaining plugin-dependent.
- [Measure the current cost of combined content schemas](issues/02-measure-the-current-cost-of-combined-content-schemas.md) - Baseline 100-document cold builds and a 1,000-document mixed project; combinations parse twice per document because excerpt/TOC share one cache while the primary Markdown/MDX pipeline parses independently.
- [Define the semantic invariants of shared content derivation](issues/03-define-the-semantic-invariants-of-shared-content-derivation.md) - Identify content by origin, selected text, and parse dialect/config; require deterministic isolated-equivalent results, branch mutation isolation, order-independent async siblings, and non-evaluating static MDX TOC/excerpt projections.
- [Choose the public composition model for content derivations](issues/04-choose-the-public-composition-model-for-content-derivations.md) - Use directly consumable Markdown/MDX schemas as immutable dialect/profile roots for independent sibling projections; remove ambiguous top-level TOC/excerpt schemas.
- [Choose the shared processing and cache architecture](issues/05-choose-the-shared-processing-and-cache-architecture.md) - Use an explicitly assembled record-scoped artifact broker that coalesces only matching pristine parses and isolates every demanded transform branch.
- [Define plugin execution and isolation semantics](issues/06-define-plugin-execution-and-isolation-semantics.md) - Keep ordinary Unified plugin semantics; share only compatible pristine parses, isolate observable branch state without prescribing processor or clone mechanics, and grant static optimization by behavior rather than built-in identity.
- [Define the custom schema extension contract](issues/07-define-the-custom-schema-extension-contract.md) - Keep arbitrary custom Zod schemas as independent black boxes; expose no general `.project()` recipe, pristine representation, or public broker capability in 1.0.
- [Define cache identity, lifetime, and concurrency semantics](issues/08-define-cache-identity-lifetime-and-concurrency-semantics.md) - Compare parse inputs and profiles exactly within a record broker, retain fulfilled or rejected parse slots through validation, isolate uncached branches, and release every artifact at record disposal.
- [Define asset effects, diagnostics, and failure semantics](issues/09-define-asset-effects-diagnostics-and-failure-semantics.md) - Use branch-local outcomes, record-atomic declarative effects, canonical provenance ordering, and last-successful build/output commits across diagnostics, assets, prepare hooks, and partial failures.
- [Set the 1.0 content performance acceptance criteria](issues/10-set-the-1-0-content-performance-acceptance-criteria.md) - Gate exact sharing, isolation, disposal, and publication invariants in CI, and gate paired built-dist 100/1,000-document regressions plus linear 20,000-document stress behavior on a dedicated release host.
- [Resolve the internal content capability seam](issues/19-resolve-the-internal-content-capability-seam.md) - Carry a distinct public schema view and one private record-bound content capability in a single leased schema run context; remove public derived content representations.
- [Define schema run storage ownership](issues/21-define-schema-run-storage-ownership.md) - Let the default Node runtime own one process-wide propagation-and-lease host while internal Builders receive narrow runners and retain independent record, epoch, and disposal lifecycles.
- [Reconcile parse sharing and VFile continuity](issues/22-reconcile-parse-sharing-and-vfile-continuity.md) - Preserve parse-once sharing through an internal immutable VFile seed, materialize isolated branch VFiles with logical state continuity, and require deterministic reentrant parser plugins without a no-share marker.
- [Finalize the built-in projection contract](issues/20-finalize-the-built-in-projection-contract.md) - Fix the complete excerpt code-point/ellipsis contract, Velite-owned Unicode TOC slug semantics with duplicate slugs unchanged, and an independently calculable metadata regex and frozen range oracle.
- [Complete effect and diagnostic transaction seams](issues/23-complete-effect-and-diagnostic-transaction-seams.md) - Fix one recursively immutable public diagnostic shape, deterministic tagged context/cause normalization, and the sole validated append-only prepare sink without exposing transaction or broker state.
- [Define generation publication and epoch lifecycle](issues/24-define-generation-publication-and-epoch-lifecycle.md) - Await one manifest-bounded first cleanup attempt before immutable results, retire through private reader pins plus a one-predecessor external window, and preserve pre-disposal admitted publication authority while disposal drains.
- [Define content schema migration guidance](issues/18-define-content-schema-migration-guidance.md) - Keep a stable complete breaking-change inventory and separate Ticket 11's executable pre-implementation evidence contract from mandatory post-implementation migration and release artifacts.
- [Make performance acceptance executable](issues/25-make-performance-acceptance-executable.md) - Preserve the fixed protocol and gates while separating Ticket 11's executable pre-implementation evidence contract from post-implementation release bundles and independently recalculated verdicts.
- [Approve the complete 1.0 content derivation design](issues/11-approve-the-complete-1-0-content-derivation-design.md) - Approve the reconciled public contract, private seams, lifecycle, migration, and executable pre-implementation evidence contract for handoff to implementation planning without entering planning or release acceptance.

## Not yet specified

- The final implementation-plan slicing depends on the selected kernel boundaries and remains beyond the current visible frontier.

## Out of scope

- Implementing or migrating the selected design; hand off to an execution-planning flow once the design is complete.
- Core redesigns without a direct, evidenced benefit to content derivation correctness, performance, simplicity, or extensibility.
- Preserving pre-1.0 APIs through compatibility shims by default.
