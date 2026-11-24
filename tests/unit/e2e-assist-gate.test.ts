import { describe, expect, it } from 'vitest'
import { isDevE2eAssistEnabled, readE2eAssistRole } from '../../src/lib/e2e-assist.ts'

describe('dev e2e assist gate', () => {
  it('is disabled in production builds', () => {
    expect(isDevE2eAssistEnabled({ dev: false, assistFlag: 'true' })).toBe(false)
    expect(readE2eAssistRole()).toBeNull()
  })

  it('requires DEV and the assist flag together', () => {
    expect(isDevE2eAssistEnabled({ dev: true, assistFlag: 'true' })).toBe(true)
    expect(isDevE2eAssistEnabled({ dev: true, assistFlag: undefined })).toBe(false)
    expect(isDevE2eAssistEnabled({ dev: false, assistFlag: 'true' })).toBe(false)
  })

  it('uses the compile-time assist flag when no env override is passed', () => {
    expect(isDevE2eAssistEnabled()).toBe(__POS_DEV_E2E_ASSIST__ === true)
  })
})