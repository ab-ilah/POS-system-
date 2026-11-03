import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanDirectory, scanText } from '../../scripts/scan-bundle.mjs'

function jwt(role: string | undefined): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(role ? { role } : { iss: 'example' })).toString('base64url')
  return `${header}.${payload}.signature`
}

describe('scanText', () => {
  it('allows an anon JWT and rejects other roles, secret keys, and the service role claim', () => {
    expect(scanText(`key=${jwt('anon')}`)).toEqual([])
    expect(scanText(`key=${jwt('service_role')}`).map((finding) => finding.reason)).toEqual(
      expect.arrayContaining([expect.stringMatching(/service_role/), expect.stringMatching(/not anon/)]),
    )
    expect(scanText(`key=${jwt('authenticated')}`).some((finding) => /not anon/.test(finding.reason))).toBe(
      true,
    )
    expect(scanText('prefix sb_secret_example suffix').some((finding) => /sb_secret_/.test(finding.reason))).toBe(
      true,
    )
    expect(scanText('e.startsWith(`sb_secret_`)')).toEqual([])
    expect(scanText('plain app code')).toEqual([])
  })

  it('matches an exact forbidden secret only when one is provided, and does not echo it', () => {
    const secret = 'super-secret-value-not-a-real-key'
    const findings = scanText(`bundle contains ${secret}`, { forbiddenSecret: secret })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.reason).not.toContain(secret)
    expect(scanText(`bundle contains ${secret}`)).toEqual([])
  })
})

describe('scanDirectory', () => {
  it('fails closed when the build output is missing and scans nested files', async () => {
    await expect(scanDirectory(join(tmpdir(), 'missing-dist-pos'))).rejects.toThrow(/does not exist/)

    const root = await mkdtemp(join(tmpdir(), 'pos-dist-'))
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'assets', 'app.js'), `const key = "${jwt('anon')}";`, 'utf8')
    expect(await scanDirectory(root)).toEqual([])

    await writeFile(join(root, 'assets', 'bad.js'), jwt('service_role'), 'utf8')
    const findings = await scanDirectory(root)
    expect(findings.some((finding) => finding.file.endsWith('bad.js'))).toBe(true)
  })
})
