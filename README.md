# Clothing POS

Frontend for a clothing-store point of sale in Ghana. Money is stored as integer pesewas (tax-inclusive shelf prices) and shown as GHS.

This repository is the POS-02 frontend scaffold. Schema, RLS, seed data, and the role-matrix source of truth are in [POS-System-backend](https://github.com/ab-ilah/POS-System-backend). That work is out of scope here. Role-gated navigation (Sell, Sales, Products, Stock, Day, Staff, Settings) is POS-04 and is not part of this shell.

The repo is public. Do not commit keys. The service-role key must never appear in this repo or in the client bundle.

## Stack

React, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, `@supabase/supabase-js`, Vitest, Playwright, ESLint.

`vite-plugin-pwa` is installed and **disabled** in `vite.config.ts`. The offline strategy is a later ADR. Do not enable the plugin before that decision.

## Local development

Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app opens on the Vite dev URL. `/` is the register placeholder. `/login` is the staff sign-in form. Sign-in goes through `src/lib/data` and does nothing useful until the env vars point at a real project.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint, including the Supabase import boundary |
| `npm test` | Vitest unit tests |
| `npm run build` | Typecheck and production build |
| `npm run scan:bundle` | Fail if `dist/` contains `service_role`, an `sb_secret_…` key, or a JWT whose role is not `anon` |
| `npm run permissions:check` | Pin-check the vendored role matrix and compare it when the backend file exists |
| `npm run test:e2e` | Playwright smoke test. Requires `npm run build` and `npx playwright install chromium` |
| `npm run ci` | Permissions check, typecheck, lint, unit tests, build, and bundle scan. Install Playwright before `test:e2e`; Actions does that in the workflow |

## Environment variables

`.env.example` lists the only two variables this app reads:

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon (public) key. Safe to ship in the browser. RLS still applies. |

No other `VITE_` variables. Vite inlines these into the client bundle at build time. Do not put the service-role key in either variable.

For local development against staging, use project `hnbvmxebzaocdttlteib` (region `eu-west-2`):

```bash
VITE_SUPABASE_URL=https://hnbvmxebzaocdttlteib.supabase.co
VITE_SUPABASE_ANON_KEY=<staging anon key>
```

Copy the anon key from the Supabase dashboard for that project (Settings → API Keys, legacy anon key). Do not copy the service-role key.

## Layout

```text
src/app            router, query client, shell
src/features       login and register screens
src/components/ui  shadcn-style primitives
src/lib            money, permissions, utilities
src/lib/data       the only place that constructs a Supabase client
src/shared         vendored permissions matrix
src/types          shared id and role types
tests/unit         Vitest
tests/e2e          Playwright
```

UI code cannot import `@supabase/supabase-js` or the resolved `src/lib/data/supabase.ts` module. ESLint resolves the import path, so a relative import that does not contain the words `lib/data` is still blocked. Screens call `src/lib/data`.

`commitSale` does not upsert. It sends the header and lines through one `commit_sale` RPC, keyed by a client-generated idempotency id. The function is a backend follow-up; the contract is in [docs/commit-sale.md](docs/commit-sale.md). Prices are integer pesewas. `formatGhs` renders them as Ghana cedis. There is no float conversion.

`isAllowed` / `assertAllowed` read `src/shared/permissions.matrix.ts` (one row per role, table, and operation). The staff role is taken from `app_metadata.role` only. See [docs/permissions-sync.md](docs/permissions-sync.md) for the sync script and the plan to replace the vendored file with a package.

## Secrets Gabriel needs to add

Nothing in this list is committed. CI on pull requests passes with none of these set. Fork pull requests never receive secrets (`pull_request` only, never `pull_request_target`).

### GitHub environment `preview`

Used by `.github/workflows/preview.yml` for same-repo pull requests only. Values are staging, never production. See [docs/preview.md](docs/preview.md).

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `VITE_SUPABASE_URL` | `https://hnbvmxebzaocdttlteib.supabase.co` |
| Secret | `VITE_SUPABASE_ANON_KEY` | Staging anon key for `hnbvmxebzaocdttlteib` |

The build job is the only preview step that runs pull-request code, and it receives only those two values. Do not put `VERCEL_TOKEN` or `CLOUDFLARE_API_TOKEN` on a step that runs `scripts/preview.mjs`. Host tokens belong on a later trusted deploy step that does not execute pull-request code. Enable required reviewers on the `preview` environment before that step exists. See [docs/preview.md](docs/preview.md).

### Repository secret, post-merge bundle scan only

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `BUNDLE_SCAN_FORBIDDEN_SECRET` | Optional. The service-role key, or any other string that must not appear in `dist/`. |

`.github/workflows/ci.yml` passes this secret only when `github.event_name == 'push'` (merges to `main`). Pull requests do not receive it. The scanner reports a hit without printing the value. Leave it unset until you want that exact-match check; the structural scan still runs.

### Production (not used by these workflows)

Do not put production values in `preview` or in local `.env.local` unless you mean to.

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://vasbjwzykqoebbtvqnjx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Production anon key |

There is still no frontend environment that should ever hold the service-role key. Production deploys are not part of this scaffold.

## CI

`.github/workflows/ci.yml` job `verify`: install, permissions sync check, typecheck, lint, unit tests, build, bundle scan, Playwright smoke test.

`.github/workflows/preview.yml`: same-repo pull requests. The build job uses the `preview` environment and the staging anon key. The deploy job is a stub with no secrets and no pull-request checkout.

Branch protection, secret scanning, push protection, and Dependabot are documented in [docs/branch-protection.md](docs/branch-protection.md).
