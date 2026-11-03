import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const STAGING_REF = 'hnbvmxebzaocdttlteib'
export const PROD_REF = 'vasbjwzykqoebbtvqnjx'

const HOSTS = new Set(['vercel', 'cloudflare'])

export function planPreview(env) {
  const host = (env.PREVIEW_HOST ?? '').trim().toLowerCase()
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (url.includes(PROD_REF)) {
    return { action: 'fail', reason: 'Preview must not target the production Supabase project.' }
  }
  if (url && !url.includes(STAGING_REF)) {
    return { action: 'fail', reason: 'Preview URL must be the staging Supabase project.' }
  }
  if (host && !HOSTS.has(host)) {
    return { action: 'fail', reason: `Unknown PREVIEW_HOST "${host}". Use vercel or cloudflare.` }
  }
  if (!host) {
    return {
      action: 'skip',
      reason: 'PREVIEW_HOST is unset. Choose Vercel or Cloudflare Pages before previews deploy.',
    }
  }
  if (!url || !anonKey) {
    return { action: 'skip', reason: 'Staging anon URL and key are not in the preview environment yet.' }
  }
  if (host === 'vercel' && !env.VERCEL_TOKEN?.trim()) {
    return { action: 'skip', reason: 'VERCEL_TOKEN is not configured yet.' }
  }
  if (host === 'cloudflare' && !(env.CLOUDFLARE_API_TOKEN?.trim() && env.CLOUDFLARE_ACCOUNT_ID?.trim())) {
    return { action: 'skip', reason: 'Cloudflare token or account id is not configured yet.' }
  }
  return { action: 'deploy', host }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

function main() {
  const plan = planPreview(process.env)
  if (plan.action === 'fail') {
    console.error(`preview: ${plan.reason}`)
    return 1
  }
  if (plan.action === 'skip') {
    console.log(`preview: ${plan.reason}`)
    return 0
  }

  console.log(`preview: building against staging for ${plan.host}. Deploy adapter is a stub and will not upload.`)
  const build = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: process.env,
  })
  if (build.status !== 0) return build.status ?? 1
  const scan = spawnSync('node', ['scripts/scan-bundle.mjs'], { stdio: 'inherit' })
  if (scan.status !== 0) return scan.status ?? 1
  console.log(`preview: stub — ${plan.host} adapter is not executed. See docs/preview.md.`)
  return 0
}

if (isDirectRun()) {
  process.exit(main())
}
