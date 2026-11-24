import { describe, expect, it } from 'vitest'
import { resolveDevE2eStaffSession } from '../../src/app/staff-session.tsx'

describe('resolveDevE2eStaffSession', () => {
  it('ignores VITE_E2E_STAFF_ROLE in production builds', () => {
    expect(resolveDevE2eStaffSession({ production: true, roleRaw: 'cashier' })).toBeNull()
  })

  it('allows a dev-only staff role when not in production', () => {
    expect(resolveDevE2eStaffSession({ production: false, roleRaw: 'cashier' })).toEqual({
      role: 'cashier',
      userId: 'e2e-staff-user',
    })
  })
})