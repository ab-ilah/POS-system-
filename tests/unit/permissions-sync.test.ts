import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { evaluatePermissionsSync, matrixBodyHash } from '../../scripts/sync-permissions-matrix.mjs'

const localSource = await readFile('src/shared/permissions.matrix.ts', 'utf8')
const pinnedHash = (await readFile('src/shared/permissions.matrix.sha256', 'utf8')).trim()

describe('permissions matrix pin', () => {
  it('matches the vendored file', () => {
    expect(matrixBodyHash(localSource)).toBe(pinnedHash)
  })

  it('fails a local edit while the upstream file is still missing', () => {
    const edited = localSource.replace('staff: denyAll', 'staff: allowAll')
    const decision = evaluatePermissionsSync({
      localSource: edited,
      pinnedHash,
      remote: { status: 404 },
    })
    expect(decision.exitCode).toBe(1)
    expect(decision.state).toBe('pending')
    expect(decision.message).toContain('PENDING')
  })

  it('reports a missing upstream file as PENDING when the pin matches', () => {
    const decision = evaluatePermissionsSync({
      localSource,
      pinnedHash,
      remote: { status: 404 },
    })
    expect(decision).toMatchObject({ state: 'pending', exitCode: 0 })
    expect(decision.message).toContain('PENDING')
    expect(decision.message).toContain('HTTP 404')
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
