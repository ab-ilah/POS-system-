/**
 * SYNCED FROM THE BACKEND.
 *
 * Vendored copy of the role matrix. The source of truth is
 * `shared/permissions.matrix.ts` in
 * https://github.com/ab-ilah/POS-System-backend
 * (that file is not published yet).
 *
 * Do not change policy in this copy. `scripts/sync-permissions-matrix.mjs`
 * diffs it against the backend file once that file exists. Replace this
 * vendored module with a shared package when the backend publishes one.
 * See docs/permissions-sync.md.
 *
 * Rows are role x table x operation, each marked allow or deny. This gates
 * the UI only. Postgres RLS in the backend repo is the security boundary.
 * Staff role comes from app_metadata, never user_metadata.
 */

export const ROLES = ['owner', 'manager', 'cashier'] as const
export const TABLES = [
  'stores',
  'staff',
  'categories',
  'products',
  'product_variants',
  'inventory',
  'customers',
  'sales',
  'sale_lines',
  'payments',
  'cash_shifts',
  'returns',
] as const
export const OPERATIONS = ['select', 'insert', 'update', 'delete'] as const
export const DECISIONS = ['allow', 'deny'] as const

export type Role = (typeof ROLES)[number]
export type TableName = (typeof TABLES)[number]
export type Operation = (typeof OPERATIONS)[number]
export type Decision = (typeof DECISIONS)[number]

export type PermissionRow = {
  role: Role
  table: TableName
  operation: Operation
  decision: Decision
}

type OperationGrants = { readonly [Op in Operation]: Decision }
type TableGrants = { readonly [Table in TableName]: OperationGrants }
type RoleGrants = { readonly [R in Role]: TableGrants }

const allowAll = {
  select: 'allow',
  insert: 'allow',
  update: 'allow',
  delete: 'allow',
} as const satisfies OperationGrants

const readOnly = {
  select: 'allow',
  insert: 'deny',
  update: 'deny',
  delete: 'deny',
} as const satisfies OperationGrants

const denyAll = {
  select: 'deny',
  insert: 'deny',
  update: 'deny',
  delete: 'deny',
} as const satisfies OperationGrants

const appendOnly = {
  select: 'allow',
  insert: 'allow',
  update: 'deny',
  delete: 'deny',
} as const satisfies OperationGrants

const noDelete = {
  select: 'allow',
  insert: 'allow',
  update: 'allow',
  delete: 'deny',
} as const satisfies OperationGrants

const updateOnly = {
  select: 'allow',
  insert: 'deny',
  update: 'allow',
  delete: 'deny',
} as const satisfies OperationGrants

const POLICY = {
  owner: {
    stores: allowAll,
    staff: allowAll,
    categories: allowAll,
    products: allowAll,
    product_variants: allowAll,
    inventory: allowAll,
    customers: allowAll,
    sales: allowAll,
    sale_lines: allowAll,
    payments: allowAll,
    cash_shifts: allowAll,
    returns: allowAll,
  },
  manager: {
    stores: updateOnly,
    staff: noDelete,
    categories: allowAll,
    products: allowAll,
    product_variants: allowAll,
    inventory: allowAll,
    customers: allowAll,
    sales: appendOnly,
    sale_lines: appendOnly,
    payments: appendOnly,
    cash_shifts: noDelete,
    returns: appendOnly,
  },
  cashier: {
    stores: readOnly,
    staff: denyAll,
    categories: readOnly,
    products: readOnly,
    product_variants: readOnly,
    inventory: readOnly,
    customers: noDelete,
    sales: appendOnly,
    sale_lines: appendOnly,
    payments: appendOnly,
    cash_shifts: noDelete,
    returns: appendOnly,
  },
} as const satisfies RoleGrants

export const PERMISSIONS_MATRIX: readonly PermissionRow[] = ROLES.flatMap((role) =>
  TABLES.flatMap((table) =>
    OPERATIONS.map((operation) => ({
      role,
      table,
      operation,
      decision: POLICY[role][table][operation],
    })),
  ),
)
