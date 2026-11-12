import { createContext } from 'react'
import type { StaffSession } from '@/lib/data/session.ts'

export type StaffSessionState = {
  ready: boolean
  session: StaffSession | null
}

export const StaffSessionContext = createContext<StaffSessionState>({ ready: false, session: null })
