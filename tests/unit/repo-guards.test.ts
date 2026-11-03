import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesUnder(path) : [path]
    }),
  )
  return nested.flat()
}

describe('repository guards', () => {
  it('publishes only the two public Supabase env vars', async () => {
    const text = await readFile('.env.example', 'utf8')
    const keys = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => line.split('=')[0])
    expect(keys).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  })

  it('keeps project refs and privileged key material out of the client source', async () => {
    const files = (await filesUnder('src')).filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
    const forbidden = ['service_role', 'sb_secret_', 'hnbvmxebzaocdttlteib', 'vasbjwzykqoebbtvqnjx']
    for (const path of files) {
      const text = await readFile(path, 'utf8')
      for (const needle of forbidden) {
        expect(text, `${path} contains ${needle}`).not.toContain(needle)
      }
    }
  })

  it('wires CI without pull_request_target and keeps fork previews off', async () => {
    const ci = await readFile('.github/workflows/ci.yml', 'utf8')
    const preview = await readFile('.github/workflows/preview.yml', 'utf8')
    expect(ci).not.toContain('pull_request_target')
    expect(preview).not.toContain('pull_request_target')
    expect(ci).toContain('npm run typecheck')
    expect(ci).toContain('npm run lint')
    expect(ci).toContain('npm test')
    expect(ci).toContain('npm run build')
    expect(ci).toContain('npm run scan:bundle')
    expect(ci).toContain('npm run test:e2e')
    expect(ci).toContain('permissions:check')
    expect(ci).toContain("github.event_name == 'push'")
    expect(preview).toContain('github.event.pull_request.head.repo.full_name == github.repository')
    expect(preview).toContain('environment: preview')
    expect(preview).toContain('hnbvmxebzaocdttlteib')
  })

  it('installs vite-plugin-pwa and leaves it disabled', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8')
    const pkg = await readFile('package.json', 'utf8')
    expect(pkg).toContain('vite-plugin-pwa')
    expect(viteConfig).toContain('VitePWA')
    expect(viteConfig).toMatch(/disable:\s*true/)
  })
})
