# Establish the safe reuse boundaries of Unified and MDX processors

Status: resolved
Origin: #388 (deleted from GitHub)
Created: 2026-07-15T12:06:35Z
Type: research

---

## Question

Which parse, transform, run, and compile artifacts can Unified, remark/rehype, and `@mdx-js/mdx` safely reuse across Markdown HTML, MDX code, excerpt, TOC, and custom derivations, and which plugin or syntax-extension behaviors require isolation or reparsing?

## Answer

A pristine parse tree may be shared only when the source text, dialect, and complete parser-extension configuration match. Markdown and MDX require separate parse artifacts; a CommonMark/GFM tree is not a valid substitute for an MDX-aware parse. Proven read-only projections may inspect the matching pristine tree, while every transforming branch requires observably independent AST and VFile state.

Post-transform artifacts are reusable only by consumers that begin at the same phase and share the exact preceding plugin chain and VFile semantics. Markdown normally transitions from mdast to hast, while MDX continues through hast to an ESTree-compatible program, so neither run output is a general shared content tree. Compiled HTML or JavaScript is a terminal artifact reusable only when every output-affecting option and file semantic matches.

Frozen processors may reuse configuration, but arbitrary plugin transformer closures are not guaranteed pure, reentrant, or concurrency-safe. Processor reuse and tree reuse are therefore separate decisions. The current manual MDX `parse -> run(mdast)` split works against the inspected runtime but is not a type-supported public `@mdx-js/mdx` contract and must not become a stable Velite seam without explicit compatibility ownership.
