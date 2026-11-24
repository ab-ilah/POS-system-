import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/shared/permissions.matrix.ts'
import { roleFromAppMetadata } from '@/lib/permissions.ts'
import { browserSessionReader } from '@/lib/data/session.ts'
import { StaffSessionContext, type StaffSessionState } from '@/app/staff-session-context.ts'

function e2eStaffSession(): { role: Role } | null {
  const raw = import.meta.env.VITE_E2E_STAFF_ROLE?.trim()
  if (!raw) return null
  const role = roleFromAppMetadata({ role: raw })
  return role ? { role } : null
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StaffSessionState>({ ready: false, session: null })

  useEffect(() => {
    const e2e = e2eStaffSession()
    if (e2e) {
      setState({ ready: true, session: e2e })
      return
    }
    const reader = browserSessionReader()
    if (!reader) {
      setState({ ready: true, session: null })
      return
    }
    return reader.onStaffSessionChange((session) => {
      setState({ ready: true, session })
    })
  }, [])

  const value = useMemo(() => state, [state])
  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
}

export function StaffSessionTestProvider({
  role,
  children,
}: {
  role: Role | null
  children: ReactNode
}) {
  const session = role ? { role } : null
  return (
    <StaffSessionContext.Provider value={{ ready: true, session }}>{children}</StaffSessionContext.Provider>
  )
}
