# Branch protection for `main`

Apply these settings on the public repository after this scaffold is merged. They are GitHub settings, not something CI can turn on by itself.

GitHub user for the required review: **ab-ilah** (repository owner). `.github/CODEOWNERS` lists `@ab-ilah` for the whole tree. If Gabriel reviews from a different login, change that line and the review rule together.

## Pull requests

Settings → Branches → Add branch ruleset (or classic branch protection rule) for `main`.

- Require a pull request before merging.
- Required approvals: **1**.
- Require review from Code Owners, so the approval has to come from Gabriel (`@ab-ilah`).
- Require status checks to pass before merging. Required check: **verify** (job in `.github/workflows/ci.yml`). Do not require the `preview` job. It is a stub and is skipped for forks.
- Do not allow bypassing the above settings. That includes administrators.
- Block force pushes.
- Do not allow deletions of `main`.

Do not use a workflow with `pull_request_target`. Fork pull requests must not receive secrets. The `verify` job is written so it passes with no secrets configured.

## Secret scanning and push protection

Settings → Code security (or Code security and analysis):

- Secret scanning: **Enabled**.
- Push protection: **Enabled**.

The service-role key must not be committed. Push protection should reject it if it is pasted into a file. The client bundle scan is a second check and is not a substitute for push protection.

## Dependabot

In the same Code security settings:

- Dependabot alerts: **Enabled**.
- Dependabot security updates: **Enabled**.

`.github/dependabot.yml` already opens weekly version updates for npm and GitHub Actions. Merging to `main` is what turns that file on.
