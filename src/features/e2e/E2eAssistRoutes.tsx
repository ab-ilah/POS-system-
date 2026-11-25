import { Navigate, useParams } from 'react-router-dom'
import { ROLES } from '@/shared/permissions.matrix.ts'
import { roleFromAppMetadata } from '@/lib/permissions.ts'
import { writeE2eAssistRole } from '@/lib/e2e-assist.ts'

export function E2eAssistScreen() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">E2E role assist</h1>
      <p className="text-sm text-muted-foreground">Pick a staff role for automated UI tests (dev only).</p>
      <ul className="space-y-2">
        {ROLES.map((role) => (
          <li key={role}>
            <a className="text-sm font-medium underline" href={`/__e2e/as/${role}`}>
              Act as {role}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function E2eRoleSwitchScreen() {
  const { role = '' } = useParams()
  const resolved = roleFromAppMetadata({ role })
  if (!resolved) {
    return <Navigate to="/__e2e/assist" replace />
  }
  writeE2eAssistRole(resolved)
  if (typeof window !== 'undefined') {
    window.location.replace('/products')
  }
  return <p className="text-sm text-muted-foreground">Switching role…</p>
}