# Process linked assets in inline MDX JSX elements

Status: needs-triage
Origin: #401 (deleted from GitHub)
Created: 2026-07-16T02:25:18Z
Labels: bug

---

## Problem

The MDX linked-file plugin visits `mdxJsxFlowElement` nodes but not `mdxJsxTextElement` nodes. Relative asset attributes on inline JSX are therefore left unchanged even though the schema option describes linked files on MDX JSX attributes generally.

Example: `Text <Icon src="./inline.png" />` is not processed, while a block JSX element is.

Evidence: `src/core/content/asset-links.ts` registers only a `mdxJsxFlowElement` visitor.

## Expected behavior

Apply the same static string-attribute handling to both flow and text MDX JSX elements.

## Design context

The broader plugin contract is being decided in [Define plugin execution and isolation semantics](06-define-plugin-execution-and-isolation-semantics.md), part of [Design the 1.0 shared content derivation kernel](../map.md).
