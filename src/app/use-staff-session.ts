import { useContext } from 'react'
import type { Role } from '@/shared/permissions.matrix.ts'
import { StaffSessionContext, type StaffSessionState } from '@/app/staff-session-context.ts'

export function useStaffSession(): StaffSessionState {
  return useContext(StaffSessionContext)
}

export function useStaffRole(): Role | null {
  return useStaffSession().session?.role ?? null
}
