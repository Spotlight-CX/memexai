# Memory Health Signals

## Status: Planned

## Problem

Memory decays silently unless operators see review-worthy signals. Files can be written once and never used, overwritten by a temporary task agent, injected into prompts for months without review, or contradicted by newer memory. None of those situations necessarily creates a runtime error.

Dreaming can clean some memory automatically, but teams still need diagnostics and review workflows. The product should make suspicious memory visible before it becomes invisible product risk.

## Proposed Signals

Start with signals that can be computed from existing revisions, access logs, prompt-block events, and observation data. Add persistent metadata only when it unlocks a clear workflow.

| Signal | Meaning | First data source |
|---|---|---|
| Never used in 30 days | File was written but not read, searched, or injected recently | `mx_access_log`, prompt snapshot ledger |
| Written by one-off agent | Latest writer looks temporary, task-scoped, or uncommon | `mx_revision.actor`, observation actor |
| No owner | File has no assigned owner once ownership metadata exists | future file metadata |
| Frequently injected but never updated | File influences many prompts but has not been reviewed or rewritten recently | prompt snapshots, `mx_file.updated_at` |
| Conflicts with newer memory | Older fact appears contradicted by a newer file or revision | model-assisted lint, revision timestamps |

Additional useful signals:
- High revision churn
- Large hot file
- Stale shared guidance
- Missing index entry
- Orphan file
- Dream changed this recently

## Product Experience

The Observability view should grow into a Memory Health workbench rather than only charts and topology.

```text
Observability > Memory Health

[Needs review] [Stale] [Ownerless] [High churn] [Conflicts]

Signal                  File                         Why
Never used in 30 days   users/u1/debug-notes.md      Written once, never read
No owner                users/u2/project.md          Owner missing
Possible conflict       users/u4/preferences.md      Newer correction exists
```

Clicking a signal opens the file with evidence in the right sidebar:

```text
Files > users/u4/preferences.md

Right sidebar: Health
- Signal: Possible conflict
- Older revision: rev_123, May 14, assistant
- Newer revision: rev_987, Jun 2, support-agent
- Last injected: 3 days ago
- Last read: 9 days ago

[Mark reviewed] [Open diff] [Edit file]
```

## Review Workflow

Signals should be reviewable, not only informational.

Useful operator actions:
- Mark reviewed
- Snooze until a date
- Assign owner
- Set TTL or review window
- Open diff
- Edit file
- Pause dreaming for this user during sensitive review

The first version can omit persistent review state and focus on surfacing signals. The second version should store review status so operators are not shown the same accepted signal forever.

## Relationship To Dreaming

Dreaming handles part of automatic maintenance: deduplication, consolidation, contradiction cleanup, and readability. Memory Health Signals are the operator layer around that:
- Before dreaming: identify risky memory and review candidates
- During dreaming: show which files were changed or skipped
- After dreaming: flag new conflicts, low-confidence summaries, and files still needing review

This is why memory health should no longer be described as fully de-prioritized. Cleanup-only health is partly absorbed by dreaming; diagnostics and operator review are reprioritized.

## Success Criteria

| Criterion | Measurement |
|---|---|
| Signals are visible | Observability or Files UI shows review-worthy memory signals |
| Signals explain themselves | Each signal includes a one-line reason and source evidence |
| File drilldown works | Clicking a signal opens the relevant file and supporting revisions/access data |
| Existing data is used first | At least initial stale/churn/usage signals work without new metadata columns |
| Governance can extend it | Owner, TTL, and review state can be layered in without changing the mental model |

## Open Questions

- Which actor naming patterns count as one-off agents?
- Should 30 days be configurable per deployment?
- Should shared memory and user memory have different health thresholds?
- Should signal review state live in a new table or file-level metadata?
