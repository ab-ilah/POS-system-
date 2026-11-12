import { canExecuteCommitSale, isAllowed } from '@/lib/permissions.ts'
import type { Operation, Role, TableName } from '@/shared/permissions.matrix.ts'

export type RouteTablePermission = { table: TableName; operation: Operation }
export type RouteRpcPermission = { rpc: 'commit_sale' }
export type RoutePermission = RouteTablePermission | RouteRpcPermission

export type AppRoute = {
  path: string
  label: string
  /** Every listed requirement must pass for this role (matrix row or commit_sale RPC gate). */
  requiresAll: readonly RoutePermission[]
}

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/sell', label: 'Sell', requiresAll: [{ rpc: 'commit_sale' }] },
  { path: '/sales', label: 'Sales', requiresAll: [{ table: 'sales', operation: 'update' }] },
  { path: '/products', label: 'Products', requiresAll: [{ table: 'products', operation: 'insert' }] },
  {
    path: '/stock',
    label: 'Stock',
    requiresAll: [{ table: 'stock_movements', operation: 'select' }],
  },
  { path: '/day', label: 'Day', requiresAll: [{ table: 'sales', operation: 'update' }] },
  {
    path: '/staff',
    label: 'Staff',
    requiresAll: [
      { table: 'profiles', operation: 'update' },
      { table: 'products', operation: 'insert' },
    ],
  },
  { path: '/settings', label: 'Settings', requiresAll: [{ table: 'stores', operation: 'update' }] },
] as const

const appRouteByPath = new Map(APP_ROUTES.map((route) => [route.path, route]))

export function normalizeAppPath(pathname: string): string {
  if (pathname === '/') return '/sell'
  return pathname
}

export function routeForPath(pathname: string): AppRoute | undefined {
  return appRouteByPath.get(normalizeAppPath(pathname))
}

function meetsRouteRequirement(role: Role, requirement: RoutePermission): boolean {
  if ('rpc' in requirement) {
    return requirement.rpc === 'commit_sale' && canExecuteCommitSale(role)
  }
  return isAllowed(role, requirement.table, requirement.operation)
}

export function canAccessRoute(role: Role, route: AppRoute): boolean {
  return route.requiresAll.every((requirement) => meetsRouteRequirement(role, requirement))
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const route = routeForPath(pathname)
  if (!route) return false
  return canAccessRoute(role, route)
}

export function visibleRoutesForRole(role: Role): AppRoute[] {
  return APP_ROUTES.filter((route) => canAccessRoute(role, route))
}

export function defaultRouteForRole(role: Role): string {
  const first = visibleRoutesForRole(role)[0]
  return first?.path ?? '/login'
}
