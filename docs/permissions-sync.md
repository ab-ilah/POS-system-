# Permissions matrix sync

The frontend permissions helper is typed against `src/shared/permissions.matrix.ts`. That file is a vendored copy. The source of truth is `shared/permissions.matrix.ts` in [POS-System-backend](https://github.com/ab-ilah/POS-System-backend).

The header in the vendored file says it is synced from the backend. Do not edit policy here.

## Check

`npm run permissions:check` runs `scripts/sync-permissions-matrix.mjs --check`.

- If the backend file is not published yet (HTTP 404), the script prints a stub message and exits 0. CI stays green while the backend repo is still empty.
- If the backend file exists and the bodies differ (vendor header ignored), the script exits 1 and prints a diff.
- `node scripts/sync-permissions-matrix.mjs --update` overwrites the vendored file from the backend and reapplies the sync header. Review the diff before committing.

CI runs the check on every pull request and on pushes to `main`. It does not need secrets.

## Package plan

This copy is temporary.

1. Publish the matrix from the backend repo (or a third repo both sides depend on) as a versioned package, for example `@pos/permissions`.
2. Add that package to this app and delete `src/shared/permissions.matrix.ts`.
3. Point `src/lib/permissions.ts` at the package exports (`ROLES`, `PERMISSIONS_MATRIX`, and the row types).
4. Delete `scripts/sync-permissions-matrix.mjs` and the CI step that runs it.

Until that package exists, the vendored file plus the diff script is the sync mechanism. UI checks are not a security boundary. Row Level Security in the backend remains authoritative.

## Shape

One row per role (`owner`, `manager`, `cashier`), table, and operation (`select`, `insert`, `update`, `delete`), with decision `allow` or `deny`. The helper reads a staff role only from `app_metadata.role`. `user_metadata` is user-editable and is ignored.

The table list in the vendored file is the frontend assumption while the backend file is absent: `stores`, `staff`, `categories`, `products`, `product_variants`, `inventory`, `customers`, `sales`, `sale_lines`, `payments`, `cash_shifts`, `returns`. When the backend publishes its matrix, `--check` will fail until this copy is updated to match.
