# Pull request previews

Previews are not wired to a host yet. The build step can target staging. Deploy is a separate stub that does not upload.

`.github/workflows/preview.yml` runs on `pull_request` only. It does not use `pull_request_target`. Both jobs run only when `github.event.pull_request.head.repo.full_name == github.repository`, so fork pull requests are skipped and never receive secrets.

## Build and deploy are split

| Job | Checks out the PR | Environment | What it receives |
| --- | --- | --- | --- |
| `build` | yes | `preview` | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only |
| `deploy` | no | none | no secrets |

`scripts/preview.mjs` runs only in the build job. It does not read `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, or any other host credential. The workflow must not pass those names into a step that executes pull-request code. A same-repo pull request can change that script; tokens in its environment would be readable.

When a host is chosen, add the token to a **trusted** deploy step that is not this script:

- Keep the deploy job from checking out the pull request, or run it from a workflow on the default branch (`workflow_run` after the pull request is merged, or a reusable workflow pinned to `main`).
- Pass `VERCEL_TOKEN` or `CLOUDFLARE_API_TOKEN` only into that trusted step.
- Turn on required reviewers for the `preview` environment so a pull request cannot use those secrets until Gabriel approves the environment.

Until then the deploy job prints a stub line and exits 0.

## URL rule

`VITE_SUPABASE_URL` must be exactly `https://hnbvmxebzaocdttlteib.supabase.co` (a trailing slash is the same origin). The check parses the URL. A query string, a path, `http`, or a lookalike host such as `hnbvmxebzaocdttlteib.supabase.co.evil.example` fails. The production host `vasbjwzykqoebbtvqnjx.supabase.co` fails.

An empty URL is **not configured yet**: the build job logs a skip and exits 0. A set URL that is not the staging origin fails.

## Values Gabriel adds on the `preview` environment

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `VITE_SUPABASE_URL` | `https://hnbvmxebzaocdttlteib.supabase.co` |
| Secret | `VITE_SUPABASE_ANON_KEY` | Staging anon key |

Do not add host tokens to this environment until the trusted deploy step exists. Production Supabase values do not belong here.
