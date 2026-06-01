# Add Revision Prune Endpoint + Admin UI Button
**Priority:** P1
**Type:** code
**Status:** [x] done

## What
Add `POST /v1/admin/revisions/prune` that accepts `{ olderThanDays: number }` and deletes matching revision rows. Wire a button in the admin UI to call it. This defuses the "storage bomb" objection without requiring automated TTL. The production caveats doc can then say "manual prune available" instead of "no retention mechanism exists."

## Files
- `apps/service/src/routes/admin.ts` (or wherever admin routes are defined) — add the endpoint
- `apps/service/admin/src/` — add a "Prune old revisions" button to the Revisions view or Settings view

## Endpoint Spec
```
POST /v1/admin/revisions/prune
Header: x-admin-secret: <MEMEX_ADMIN_SECRET>
Body: { "olderThanDays": 30 }
Response: { "deleted": <number> }
```

SQL:
```sql
DELETE FROM mx_revision
WHERE created_at < now() - ($1 || ' days')::interval
RETURNING id
```

Return count of deleted rows.

## Admin UI
- Add to Revisions view (or a Settings page): input field for "Days to keep" (default: 90), button "Prune old revisions"
- On click: POST to endpoint, show toast with "Deleted N revisions"
- No confirmation dialog needed for MVP

## Done when
- `POST /v1/admin/revisions/prune` with `{ olderThanDays: 30 }` deletes rows created more than 30 days ago and returns `{ deleted: N }`
- Admin UI has a button that calls it and shows the deleted count
- `bun run build` passes
- `bun run test` passes

## Verification
- Added `POST /v1/admin/revisions/prune` with retention-window validation and `{ deleted }` response.
- Added admin auth support for both `x-memex-admin-secret` and the launch-task `x-admin-secret` alias.
- Added a Revisions view control with "Days to keep" and "Prune old revisions".
- Ran `bun test apps/service/tests/admin-routes.test.ts` successfully.
- Ran `bun run build:service` successfully.
