# Pull request previews

Previews are not wired to a host yet. Vercel and Cloudflare Pages are both supported by `scripts/preview.mjs`; Gabriel picks one later.

`.github/workflows/preview.yml` runs on `pull_request` only. It does not use `pull_request_target`. The job runs only when `github.event.pull_request.head.repo.full_name == github.repository`, so fork pull requests are skipped and never receive secrets.

The job uses the GitHub environment named `preview`.

## Rules the script enforces

- `VITE_SUPABASE_URL` must contain the staging project ref `hnbvmxebzaocdttlteib`.
- A URL that contains the production project ref `vasbjwzykqoebbtvqnjx` fails the job.
- Any other non-empty URL fails the job.
- `PREVIEW_HOST` must be `vercel` or `cloudflare`. Unset means the host is not chosen yet: the job logs a skip and exits 0.
- The anon key is read from the `preview` environment. The script never prints it.
- When the host, staging URL, anon key, and that host's token are all present, the script builds with those values, scans `dist/`, and then stops. The upload adapter is a stub. It does not deploy.

## Switch

| `PREVIEW_HOST` | Token secrets | Extra |
| --- | --- | --- |
| unset | none | stub skip, current state |
| `vercel` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | replace the stub in `scripts/preview.mjs` with `vercel deploy` |
| `cloudflare` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | variable `CLOUDFLARE_PROJECT_NAME`; replace the stub with Wrangler Pages deploy |

`PREVIEW_HOST` and `CLOUDFLARE_PROJECT_NAME` are GitHub environment variables on `preview`, not secrets. Everything else in the table is a secret on that environment.

Production Supabase values do not belong in the `preview` environment.
