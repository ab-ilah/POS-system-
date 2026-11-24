import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { Role } from '@/shared/permissions.matrix.ts'
import { ROLES } from '@/shared/permissions.matrix.ts'
import { roleFromAppMetadata } from '@/lib/permissions.ts'

const STORAGE_KEY = 'pos-e2e-assist-role'

export function readE2eAssistRole(): Role | null {
  if (import.meta.env.VITE_E2E_ASSIST !== 'true') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return roleFromAppMetadata({ role: raw })
  } catch {
    return null
  }
}

export function E2eAssistScreen() {
  if (import.meta.env.VITE_E2E_ASSIST !== 'true') {
    return <p className="text-sm text-muted-foreground">E2E assist is not enabled.</p>
  }
  return (
    <AssistWrap className="space-y-4">
      <h1 className="text-xl font-semibold">E2E role assist</h1>
      <p className="text-sm text-muted-foreground">Pick a staff role for automated UI tests (non-production builds only).</p>
      <ul className="space-y-2">
        {ROLES.map((role) => (
          <li key={role}>
            <a className="text-sm font-medium underline" href={`/__e2e/as/${role}`}>
              Act as {role}
            </a>
          </li>
        ))}
      </ul>
    </AssistWrap>
  )
}

export function E2eRoleSwitchScreen() {
  const { role = '' } = useParams()
  if (import.meta.env.VITE_E2E_ASSIST !== 'true') {
    return <Navigate to="/login" replace />
  }
  const resolved = roleFromAppMetadata({ role })
  if (!resolved) {
    return <Navigate to="/__e2e/assist" replace />
  }
  sessionStorage.setItem(STORAGE_KEY, resolved)
  return <Navigate to="/products" replace />
}

function AssistWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}