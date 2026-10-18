# Triage Labels

The skills speak in terms of five canonical triage roles. This repo uses the default label strings — each label equals its role name.

| Label             | Meaning                                  |
| ----------------- | ---------------------------------------- |
| `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | Requires human implementation            |
| `wontfix`         | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the label string from the left column. In this repo's session-scoped tracker, the `Status:` line of a ticket file carries these values, plus `claimed` (in progress) or `resolved` (done) — the single lifecycle axis defined in `issue-tracker.md`.

Edit the left column if you adopt a different vocabulary.
