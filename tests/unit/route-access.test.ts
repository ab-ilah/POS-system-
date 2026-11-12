import { describe, expect, it } from 'vitest'
import {
  APP_ROUTES,
  canAccessPath,
  defaultRouteForRole,
  visibleRoutesForRole,
} from '../../src/lib/route-access.ts'
import { ROLES } from '../../src/shared/permissions.matrix.ts'

describe('route access from permissions matrix', () => {
  it('maps every nav item to matrix operations', () => {
    for (const route of APP_ROUTES) {
      expect(route.requiresAll.length).toBeGreaterThan(0)
      for (const requirement of route.requiresAll) {
        expect(requirement.table.length).toBeGreaterThan(0)
        expect(requirement.operation.length).toBeGreaterThan(0)
      }
    }
  })

  it('gives owner every nav destination', () => {
    expect(visibleRoutesForRole('owner').map((route) => route.label)).toEqual([
      'Sell',
      'Sales',
      'Products',
      'Stock',
      'Day',
      'Staff',
      'Settings',
    ])
  })

  it('gives manager the same nav destinations as owner', () => {
    expect(visibleRoutesForRole('manager').map((route) => route.label)).toEqual(
      visibleRoutesForRole('owner').map((route) => route.label),
    )
  })

  it('keeps cashier on sell and stock only', () => {
    expect(visibleRoutesForRole('cashier').map((route) => route.label)).toEqual(['Sell', 'Stock'])
  })

  it('defaults each matrix role to an allowed screen', () => {
    for (const role of ROLES) {
      const target = defaultRouteForRole(role)
      expect(canAccessPath(role, target)).toBe(true)
    }
  })

  it('blocks cashier from owner and manager screens', () => {
    for (const path of ['/sales', '/products', '/day', '/staff', '/settings']) {
      expect(canAccessPath('cashier', path)).toBe(false)
    }
  })
})
