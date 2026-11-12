import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/shared/permissions.matrix.ts'
import { browserSessionReader } from '@/lib/data/session.ts'
import { StaffSessionContext, type StaffSessionState } from '@/app/staff-session-context.ts'

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StaffSessionState>({ ready: false, session: null })

  useEffect(() => {
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
