# Velite 1.0 Polish — Round 2 (continuous)

Continues the finished first pass in `../20261012-1110-1.0-polish/` (see its `report.md` for what landed and what was deferred). This session is the long-running execution of the deferred items.

## Goal

Polish velite 1.0-alpha to a presentable state across code style / architecture / detail fixes / slop cleanup / docs. No feature work, no public API additions.

## Hard rules

- One ticket = one verifiable unit. Verify with `pnpm build` + full test suite (629 passing baseline) before marking a ticket `resolved`.
- `pnpm docs:build` must stay green for any docs-touching ticket.
- Order matters: 05 → 06 → 07/08 share files; do not reorder without re-reading the dependency notes in each ticket.
- Explicitly out of scope: custom-loader public registration (product decision), any new public API, GitHub Issues operations.

## Status board

| #   | Ticket                          | Scope                                                | Status   |
| --- | ------------------------------- | ---------------------------------------------------- | -------- |
| 01  | quick wins                      | classify pre-normalize, CLI debug, ADR note, cleanup | resolved |
| 02  | helper dedup                    | comparators, stringify, comment plugins, wrappers    | resolved |
| 03  | docs batch 2                    | faq, zh-CN, unaudited pages, CI docs build           | resolved |
| 04  | test script fork                | unify `test` / `test:src`                            | resolved |
| 05  | schema↔pipeline seam            | hoist `assetKeyOf` family to util, break cycle       | resolved |
| 06  | Phase 3 collectEffect migration | two-arg declarations everywhere, drop legacy bridge  | resolved |
| 07  | split `emitAndWrite`            | phase extraction in driver                           | resolved |
| 08  | split `record.ts open()`        | stage-lifecycle extraction                           | resolved |
| 09  | bench + final sweep             | perf pass, promote findings to knowledge, report     | resolved |

Update this table when claiming/resolving a ticket. Tickets carry the details.

## Cross-session continuation

If this session ends mid-effort: copy still-open tickets into the next session folder per `.agents/issue-tracker.md`, keep this folder's status board as the handoff snapshot, and write `report.md` before closing.
