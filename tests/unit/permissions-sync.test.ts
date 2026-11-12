import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_BACKEND_REFS,
  backendMatrixUrl,
  evaluatePermissionsSync,
  matrixBodyHash,
  resolveBackendRef,
} from '../../scripts/sync-permissions-matrix.mjs'

const localSource = await readFile('src/shared/permissions.matrix.ts', 'utf8')
const pinnedHash = (await readFile('src/shared/permissions.matrix.sha256', 'utf8')).trim()
const syncScript = join(process.cwd(), 'scripts/sync-permissions-matrix.mjs')

function runSyncScript(backendRef: string | undefined) {
  const env = { ...process.env }
  if (backendRef === undefined) {
    delete env.BACKEND_REF
  } else {
    env.BACKEND_REF = backendRef
  }
  return spawnSync(process.execPath, [syncScript], {
    env,
    encoding: 'utf8',
    timeout: 3_000,
  })
}

describe('resolveBackendRef', () => {
  it('defaults to staging when unset', () => {
    expect(resolveBackendRef({})).toBe('staging')
    expect(resolveBackendRef({ BACKEND_REF: undefined })).toBe('staging')
  })

  it('rejects empty or whitespace-only values', () => {
    expect(() => resolveBackendRef({ BACKEND_REF: '' })).toThrow(/BACKEND_REF is empty/)
    expect(() => resolveBackendRef({ BACKEND_REF: '   ' })).toThrow(/BACKEND_REF is empty/)
  })

  it('accepts main and staging, trimming surrounding whitespace', () => {
    expect(resolveBackendRef({ BACKEND_REF: 'main' })).toBe('main')
    expect(resolveBackendRef({ BACKEND_REF: 'staging' })).toBe('staging')
    expect(resolveBackendRef({ BACKEND_REF: ' staging ' })).toBe('staging')
    expect(ALLOWED_BACKEND_REFS).toEqual(['main', 'staging'])
    expect(backendMatrixUrl(' staging ')).toContain('/staging/shared/permissions.matrix.ts')
  })

  it('rejects other branch names', () => {
    expect(() => resolveBackendRef({ BACKEND_REF: 'dev' })).toThrow(/BACKEND_REF must be one of/)
  })
})

describe('permissions sync CLI', () => {
  it('exits 1 for invalid BACKEND_REF without fetching (fast timeout)', () => {
    for (const badRef of ['', '   ', 'dev']) {
      const result = runSyncScript(badRef)
      expect(result.status).toBe(1)
      expect(result.stderr + result.stdout).toMatch(/BACKEND_REF/)
    }
  })
})

describe('permissions matrix pin', () => {
  it('matches the vendored file', () => {
    expect(matrixBodyHash(localSource)).toBe(pinnedHash)
  })

  it('fails a local edit while the upstream file is still missing', () => {
    const edited = localSource.replace(
      'Any staff member can record a sale',
      'Any staff member can record a sale (edited)',
    )
    const decision = evaluatePermissionsSync({
      localSource: edited,
      pinnedHash,
      remote: { status: 404 },
    })
    expect(decision.exitCode).toBe(1)
    expect(decision.state).toBe('pending')
    expect(decision.message).toContain('PENDING')
  })

  it('reports a missing upstream file as PENDING, not as a match', () => {
    const decision = evaluatePermissionsSync({
      localSource,
      pinnedHash,
      remote: { status: 404 },
    })
    const matched = evaluatePermissionsSync({
      localSource,
      pinnedHash,
      remote: { status: 200, body: localSource },
    })
    expect(decision).toMatchObject({ state: 'pending', exitCode: 2 })
    expect(decision.annotation).toMatch(/^::warning::/)
    expect(decision.message).toContain('PENDING')
    expect(decision.message).toContain('HTTP 404')
    expect(matched).toMatchObject({ state: 'match', exitCode: 0 })
    expect(matched.annotation).toBeUndefined()
    expect(decision.exitCode).not.toBe(matched.exitCode)
  })

  it('fails when a published matrix differs', () => {
    const decision = evaluatePermissionsSync({
      localSource,
      pinnedHash,
      remote: {
        status: 200,
        body: `${localSource}\nexport const EXTRA = true\n`,
      },
    })
    expect(decision.exitCode).toBe(1)
    expect(decision.state).toBe('mismatch')
  })

  it('does not treat an HTML 404 body as pending', () => {
    const decision = evaluatePermissionsSync({
      localSource,
      pinnedHash,
      remote: { status: 200, body: '404: Not Found' },
    })
    expect(decision.exitCode).toBe(1)
    expect(decision.state).toBe('invalid')
  })
})
