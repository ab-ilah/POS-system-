# Permissions matrix sync

The frontend permissions helper is typed against `src/shared/permissions.matrix.ts`. That file is a vendored copy. The source of truth is `shared/permissions.matrix.ts` in [POS-System-backend](https://github.com/ab-ilah/POS-System-backend).

The header in the vendored file says it is synced from the backend. Do not edit policy here.

## Check

`npm run permissions:check` runs `scripts/sync-permissions-matrix.mjs --check`.

The check always hashes the vendored body (the sync header is stripped first) and compares it to `src/shared/permissions.matrix.sha256`. A local edit that does not update the pin fails, including while the backend file is missing.

Upstream states:

- **PENDING** — HTTP 404. The backend file is not published (an empty repo and a private repo both look like this). The command prints `PENDING` and exits 0 only when the vendored hash matches the pin. It does not treat a 200 body that merely contains the text `404: Not Found` as missing.
- **Match** — HTTP 200, the body parses as a matrix (`PERMISSIONS_MATRIX` and `export const ROLES`), and it equals the vendored body and the pin.
- **Mismatch or invalid** — any other HTTP status, a 200 that is not a matrix, or a matrix that differs. Exit 1.

`node scripts/sync-permissions-matrix.mjs --update` rewrites the vendored file and the pin from a real 200 matrix. It does not run when the upstream file is missing.

CI runs the check on every pull request and on pushes to `main`. It does not need secrets.

## Package plan

This copy is temporary.

1. Publish the matrix from the backend repo (or a third repo both sides depend on) as a versioned package, for example `@pos/permissions`.
2. Add that package to this app and delete `src/shared/permissions.matrix.ts` and the pin.
3. Point `src/lib/permissions.ts` at the package exports (`ROLES`, `PERMISSIONS_MATRIX`, and the row types).
4. Delete `scripts/sync-permissions-matrix.mjs` and the CI step that runs it.

Until that package exists, the vendored file, the hash pin, and the diff script are the sync mechanism. UI checks are not a security boundary. Row Level Security in the backend remains authoritative.

## Shape

One row per role (`owner`, `manager`, `cashier`), table, and operation (`select`, `insert`, `update`, `delete`), with decision `allow` or `deny`. The helper reads a staff role only from `app_metadata.role`. `user_metadata` is user-editable and is ignored.

The table list in the vendored file is the frontend assumption while the backend file is absent: `stores`, `staff`, `categories`, `products`, `product_variants`, `inventory`, `customers`, `sales`, `sale_lines`, `payments`, `cash_shifts`, `returns`. When the backend publishes its matrix, `--check` will fail until this copy and the pin are updated to match.
