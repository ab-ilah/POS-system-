import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/shared/permissions.matrix.ts'
import { roleFromAppMetadata } from '@/lib/permissions.ts'
import { readE2eAssistRole } from '@/features/e2e/E2eAssistScreen.tsx'
import { browserSessionReader, type StaffSession } from '@/lib/data/session.ts'
import { StaffSessionContext, type StaffSessionState } from '@/app/staff-session-context.ts'

export function resolveDevE2eStaffSession(env: {
  production: boolean
  roleRaw?: string
}): StaffSession | null {
  if (env.production) return null
  const raw = env.roleRaw?.trim()
  if (!raw) return null
  const role = roleFromAppMetadata({ role: raw })
  return role ? { role, userId: 'e2e-staff-user' } : null
}

function e2eStaffSession(): StaffSession | null {
  return resolveDevE2eStaffSession({
    production: import.meta.env.PROD,
    roleRaw: import.meta.env.VITE_E2E_STAFF_ROLE,
  })
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StaffSessionState>({ ready: false, session: null })

  useEffect(() => {
    const e2eAssist = readE2eAssistRole()
    if (e2eAssist) {
      setState({ ready: true, session: { role: e2eAssist, userId: `e2e-${e2eAssist}` } })
      return
    }
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
  userId = 'test-user-1',
  children,
}: {
  role: Role | null
  userId?: string
  children: ReactNode
}) {
  const session = role ? { role, userId } : null
  return (
    <StaffSessionContext.Provider value={{ ready: true, session }}>{children}</StaffSessionContext.Provider>
  )
}