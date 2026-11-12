import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { canAccessPath, defaultRouteForRole, normalizeAppPath, routeForPath } from '@/lib/route-access.ts'
import { useStaffRole, useStaffSession } from '@/app/use-staff-session.ts'

export function RoleGate({ children }: { children: ReactNode }) {
  const { ready } = useStaffSession()
  const role = useStaffRole()
  const location = useLocation()
  const path = normalizeAppPath(location.pathname)

  if (!ready) {
    return (
      <p className="text-sm text-muted-foreground" aria-busy="true">
        Loading session…
      </p>
    )
  }

  if (!role) {
    return <Navigate to="/login" replace state={{ from: path }} />
  }

  const route = routeForPath(path)
  if (!route) {
    return <Navigate to={defaultRouteForRole(role)} replace />
  }

  if (!canAccessPath(role, path)) {
    return <Navigate to={defaultRouteForRole(role)} replace />
  }

  return children
}
