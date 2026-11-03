import { describe, expect, it } from 'vitest'
import { assertAllowed, isAllowed, roleFromAppMetadata } from '../../src/lib/permissions.ts'
import { OPERATIONS, PERMISSIONS_MATRIX, ROLES, TABLES } from '../../src/shared/permissions.matrix.ts'

describe('permissions matrix', () => {
  it('has one row for every role, table, and operation', () => {
    const keys = PERMISSIONS_MATRIX.map((row) => `${row.role}:${row.table}:${row.operation}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(ROLES.length * TABLES.length * OPERATIONS.length)
    for (const row of PERMISSIONS_MATRIX) {
      expect(row.decision === 'allow' || row.decision === 'deny').toBe(true)
    }
  })

  it('lets a cashier ring a sale and blocks deleting posted sales or reading staff', () => {
    expect(isAllowed('cashier', 'sales', 'insert')).toBe(true)
    expect(isAllowed('cashier', 'sale_lines', 'insert')).toBe(true)
    expect(isAllowed('cashier', 'sales', 'delete')).toBe(false)
    expect(isAllowed('cashier', 'sales', 'update')).toBe(false)
    for (const operation of OPERATIONS) {
      expect(isAllowed('cashier', 'staff', operation)).toBe(false)
    }
  })

  it('lets the owner delete a sale and keeps posted money append-only for a manager', () => {
    expect(isAllowed('owner', 'sales', 'delete')).toBe(true)
    expect(isAllowed('manager', 'sales', 'insert')).toBe(true)
    expect(isAllowed('manager', 'sales', 'delete')).toBe(false)
    expect(isAllowed('manager', 'payments', 'update')).toBe(false)
  })

  it('throws a stable message when the role is denied', () => {
    expect(() => assertAllowed('cashier', 'sales', 'delete')).toThrow('cashier cannot delete sales')
  })
})

describe('roleFromAppMetadata', () => {
  it('accepts only the matrix roles on app_metadata', () => {
    expect(roleFromAppMetadata({ role: 'manager' })).toBe('manager')
    expect(roleFromAppMetadata({ role: 'cashier' })).toBe('cashier')
    expect(roleFromAppMetadata({ role: 'owner' })).toBe('owner')
    expect(roleFromAppMetadata({ role: 'admin' })).toBeNull()
    expect(roleFromAppMetadata(null)).toBeNull()
    expect(roleFromAppMetadata({ user_metadata: { role: 'owner' } })).toBeNull()
  })
})
