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

Correctness and predictable semantics are hard constraints; optimize representative end-to-end build performance beneath them. Support both built-in and custom schemas through a stable high-level extension boundary without necessarily stabilizing a concrete AST type. Keep normal Unified/remark/rehype and `@mdx-js/mdx` plugins usable, while explicitly defining which work cannot safely be shared. Public API shape is open. Any part of the core may change when directly justified by correctness, performance, simplicity, or extensibility of content derivation. Breaking changes are allowed before 1.0.

## Decisions so far

- [Establish the safe reuse boundaries of Unified and MDX processors](01-establish-the-safe-reuse-boundaries-of-unified-and-mdx-proce.md) - Reuse only format/config-matched pristine parse trees; clone tree and VFile per transforming branch, with processor concurrency remaining plugin-dependent.

## Not yet specified

- The migration guidance and exact compatibility story for existing schema configurations cannot be specified until the public composition model is chosen.
- The final implementation-plan slicing depends on the selected kernel boundaries and remains beyond the current visible frontier.

## Out of scope

- Implementing or migrating the selected design; hand off to an execution-planning flow once the design is complete.
- Core redesigns without a direct, evidenced benefit to content derivation correctness, performance, simplicity, or extensibility.
- Preserving pre-1.0 APIs through compatibility shims by default.
