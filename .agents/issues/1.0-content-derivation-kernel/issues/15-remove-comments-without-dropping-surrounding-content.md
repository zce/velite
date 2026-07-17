# Remove comments without dropping surrounding content

Status: needs-triage
GitHub: #402
Created: 2026-07-16T02:25:18Z
Labels: bug

---

## Problem

The Markdown comment-removal transform removes an entire mdast HTML node whenever that node contains an HTML comment. Content surrounding the comment inside the same node is lost. The MDX transform similarly removes an entire flow expression when it contains a block comment and does not cover text expressions.

Example: `<div><!-- secret --><span>keep</span></div>` can be removed completely instead of preserving the non-comment markup.

Evidence: `src/core/content/markdown.ts` and `src/core/content/mdx.ts` splice the whole child node after a regex match.

## Expected behavior

Remove only comment syntax and preserve all non-comment content, with explicit behavior for block and inline Markdown/MDX forms.

## Design context

Ordering and mutation isolation are being decided in [Define plugin execution and isolation semantics](https://github.com/zce/velite/issues/393).
