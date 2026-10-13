# 02 — Helper deduplication (mechanical)

Status: resolved

Four small duplication clusters from the round-1 audit. All mechanical, test-covered.

## Outcome

- **String comparator**: new `src/core/util/compare.ts` `compareStrings`; replaced the inline ternary at `driver.ts` (sortTree + entry sort), `pipeline/discover.ts`, `pipeline/collect.ts`, `diagnostic.ts` (record-entry sort). `diagnostic.ts`'s private copy deleted. The bigint comparison at `diagnostic.ts:335` is NOT a string comparator — left alone.
- **`stringify`**: single exported implementation in `output/plan.ts` (the planner owns content serialization); `writer.ts` imports it instead of redefining.
- **Comment-removal plugins**: new `content/execution/tree-filter.ts` `removeChildrenWhere(node, drop)` walker; the three plugins (markdown mdast html-comments, markdown hast comments, mdx expression comments) are now one-line predicates. Plugin param shapes keep `type: string` for unified `Transformer` structural compatibility.
- **markdown/mdx close-wrapper**: NOT deduplicated — the `closed` flag is shared mutable closure state read inside `configure()`; extracting the wrapper means threading a getter/setter for 8 duplicated lines. Poor ROI, recorded here as the decision.

Verified: `pnpm build` + 629/629 tests green.
