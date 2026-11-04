import {
  ROLES,
  type Operation,
  type PermissionRow,
  type Role,
  type TableName,
  PERMISSIONS_MATRIX,
} from '../shared/permissions.matrix.ts'

function findRow(role: Role, table: TableName, operation: Operation): PermissionRow | undefined {
  return PERMISSIONS_MATRIX.find(
    (row) => row.role === role && row.table === table && row.operation === operation,
  )
}

export function isAllowed(role: Role, table: TableName, operation: Operation): boolean {
  return findRow(role, table, operation)?.decision === 'allow'
}

export function assertAllowed(role: Role, table: TableName, operation: Operation): void {
  if (!isAllowed(role, table, operation)) {
    throw new Error(`${role} cannot ${operation} ${table}`)
  }
}

export function roleFromAppMetadata(appMetadata: unknown): Role | null {
  if (typeof appMetadata !== 'object' || appMetadata === null || !('role' in appMetadata)) {
    return null
  }
  const role = appMetadata.role
  if (typeof role !== 'string') return null
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : null
}
