# Measure the current cost of combined content schemas

Status: resolved
Origin: #389 (deleted from GitHub)
Created: 2026-07-15T12:06:37Z
Type: task

---

## Question

What are the current end-to-end time, peak-memory, and parse/transform invocation costs for representative documents and projects using individual and combined `s.markdown()`, `s.mdx()`, `s.excerpt()`, and `s.toc()` schemas, including normal plugin and asset-processing scenarios?

## Answer

Measured on 2026-07-17 at `3903ba3`, Linux x64, Node v26.5.0. No product behavior was changed.

### Method

- The schema matrix used 100 generated documentation-sized files per scenario. Every sample ran in a fresh Node process; fixture generation was outside the timed region.
- Time covers importing `dist/index.mjs`, loading config, creating the builder, scanning/loading/validating all sources, running schemas and assets, and writing single-layout output.
- Each scenario ran five times. The table reports median time, median sampled peak RSS, and the highest sampled peak RSS. A parent process sampled `/proc/<pid>/status` every 2 ms.
- Plugin scenarios used one remark and one rehype transformer that each traversed the complete tree. Asset scenarios included one unique local image reference per document and verified 100 emitted assets.
- Invocation counts were checked by plugin counters and asset output, then structurally traced through `src/core/schema/{markdown,mdx,excerpt,toc}.ts`, `src/core/schema/context.ts`, and `src/core/content/{markdown,mdx}.ts`.

### Cold 100-document builds

| Scenario                                   | Median time | Median peak RSS | Highest peak RSS |
| ------------------------------------------ | ----------: | --------------: | ---------------: |
| Frontmatter-only baseline                  |    144.4 ms |        107.3 MB |         126.1 MB |
| `s.markdown()`                             |    283.2 ms |        136.3 MB |         154.6 MB |
| `s.markdown()` + plugins/assets            |    314.7 ms |        147.2 MB |         156.1 MB |
| `s.mdx()`                                  |    862.4 ms |        209.8 MB |         222.1 MB |
| `s.mdx()` + plugins/assets                 |    933.4 ms |        212.2 MB |         222.8 MB |
| `s.excerpt()`                              |    221.4 ms |        125.4 MB |         150.1 MB |
| `s.toc()`                                  |    205.1 ms |        123.2 MB |         147.3 MB |
| `s.markdown()` + `s.excerpt()` + `s.toc()` |    342.6 ms |        149.0 MB |         157.1 MB |
| Markdown combination + plugins/assets      |    371.8 ms |        152.3 MB |         161.9 MB |
| `s.mdx()` + `s.excerpt()` + `s.toc()`      |    963.6 ms |        214.9 MB |         230.8 MB |
| MDX combination + plugins/assets           |  1,034.9 ms |        214.5 MB |         224.7 MB |

Peak-RSS differences of only a few MB should be treated as noise; the time medians after the first cold-filesystem sample were stable to roughly 1-3%.

Relative to the matching primary schema, adding excerpt and TOC cost 59.4 ms / 12.7 MB for Markdown and 101.2 ms / 5.1 MB for MDX. Adding the two traversing plugins plus one real linked asset per document cost another 29.2 ms for the Markdown combination and 71.3 ms for the MDX combination.

### Invocation structure

Counts below are per document and multiply linearly by document count.

| Schema selection         | Parse invocations                                       | Primary pipeline transforms | Secondary projections                |
| ------------------------ | ------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `s.markdown()`           | 1 Markdown parse                                        | 1 Unified run               | none                                 |
| `s.mdx()`                | 1 MDX parse                                             | 1 MDX run + 1 Terser minify | none                                 |
| `s.excerpt()`            | 1 CommonMark/GFM parse                                  | none                        | 1 mdast-to-hast/plain projection     |
| `s.toc()`                | 1 CommonMark/GFM parse                                  | none                        | 1 TOC traversal                      |
| Markdown + excerpt + TOC | 2 parses: 1 Markdown pipeline + 1 cached CommonMark/GFM | 1 Unified run               | 1 plain projection + 1 TOC traversal |
| MDX + excerpt + TOC      | 2 parses: 1 MDX + 1 cached CommonMark/GFM               | 1 MDX run + 1 Terser minify | 1 plain projection + 1 TOC traversal |

`s.excerpt()` and `s.toc()` share `file.mdast`, so the combination does not parse three times. However, `s.markdown()` passes the source string to `processMarkdown`, and `s.mdx()` does not pass `file.mdast` to `processMdx`; each primary pipeline therefore parses independently from the cached projection tree. In plugin scenarios, the measured remark and rehype transformers each ran exactly once per document. With one local reference, the linked-asset callback also ran once per primary pipeline invocation.

### Representative mixed project

The existing `scripts/bench-large.ts` benchmark was also run three times with 1,000 documents and 1,000 assets: 500 Markdown and 500 MDX documents, each using its primary schema plus excerpt and TOC, a linked body asset, and `s.file()`.

| Operation                       |     Median |     Observed range |
| ------------------------------- | ---------: | -----------------: |
| Full build                      | 3,364.6 ms | 3,343.8-3,386.7 ms |
| No-op rebuild                   |    63.4 ms |       63.0-65.2 ms |
| Single-file incremental rebuild |    15.1 ms |       14.8-15.1 ms |
| Process peak RSS                |   373.4 MB |     372.6-375.1 MB |

That full build performs 2,000 parses, 1,000 primary pipeline runs, 500 Terser minifications, 1,000 plain projections, and 1,000 TOC traversals. It also makes 1,000 linked-asset requests plus 1,000 `s.file()` requests, deduplicated to 1,000 unique asset derivations.

### Implication

The current shared cache already removes duplicate parsing between excerpt and TOC. The remaining shareable-looking cost is the second parse between each primary renderer/compiler and the projection path, but it is not safe to remove without honoring parse dialect/config and plugin isolation. MDX compile/minify dominates its total cost, so eliminating only the second CommonMark parse will improve combined MDX builds but cannot approach the cost of excerpt/TOC-only builds.
