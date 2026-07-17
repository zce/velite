# Establish the safe reuse boundaries of Unified and MDX processors

Status: resolved
GitHub: #388
Created: 2026-07-15T12:06:35Z
Type: research

---

## Question

Which parse, transform, run, and compile artifacts can Unified, remark/rehype, and `@mdx-js/mdx` safely reuse across Markdown HTML, MDX code, excerpt, TOC, and custom derivations, and which plugin or syntax-extension behaviors require isolation or reparsing?
