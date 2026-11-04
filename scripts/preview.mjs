import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const STAGING_HOST = 'hnbvmxebzaocdttlteib.supabase.co'
export const PROD_HOST = 'vasbjwzykqoebbtvqnjx.supabase.co'

export function supabaseProjectHost(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null
  if (parsed.pathname !== '/' && parsed.pathname !== '') return null
  return parsed.hostname
}

export function planPreview(env) {
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!url && !anonKey) {
    return { action: 'skip', reason: 'Staging URL and anon key are not in the preview environment yet.' }
  }

  const host = url ? supabaseProjectHost(url) : null
  if (host === PROD_HOST) {
    return { action: 'fail', reason: 'Preview must not target the production Supabase project.' }
  }
  if (host !== STAGING_HOST) {
    return { action: 'fail', reason: 'Preview URL must be exactly the staging project origin.' }
  }
  if (!anonKey) {
    return { action: 'skip', reason: 'Staging anon key is not in the preview environment yet.' }
  }

  return { action: 'build' }
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

function buildEnv() {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CI: process.env.CI,
    NODE_ENV: 'production',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
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

  console.log('preview: building against the staging origin. This step does not deploy and does not read host tokens.')
  const build = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: buildEnv(),
  })
  if (build.status !== 0) return build.status ?? 1
  const scan = spawnSync('node', ['scripts/scan-bundle.mjs'], { stdio: 'inherit', env: buildEnv() })
  if (scan.status !== 0) return scan.status ?? 1
  console.log('preview: build finished. Deploy is a separate trusted step. See docs/preview.md.')
  return 0
}

if (isDirectRun()) {
  process.exit(main())
}
