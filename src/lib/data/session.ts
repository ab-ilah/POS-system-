import { roleFromAppMetadata } from '../permissions.ts'
import type { Role } from '../../shared/permissions.matrix.ts'
import { browserSupabase } from './supabase.ts'

export type StaffSession = { role: Role; userId: string }

export type SessionReader = {
  getStaffSession(): Promise<StaffSession | null>
  onStaffSessionChange(listener: (session: StaffSession | null) => void): () => void
}

function staffSessionFromUser(user: { id: string; app_metadata?: unknown } | undefined): StaffSession | null {
  if (!user) return null
  const role = roleFromAppMetadata(user.app_metadata)
  if (!role) return null
  return { role, userId: user.id }
}

export function browserSessionReader(): SessionReader | null {
  const client = browserSupabase()
  if (!client) return null
  return {
    async getStaffSession() {
      const { data } = await client.auth.getSession()
      return staffSessionFromUser(data.session?.user)
    },
    onStaffSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(staffSessionFromUser(session?.user))
      })
      void client.auth.getSession().then(({ data: sessionData }) => {
        listener(staffSessionFromUser(sessionData.session?.user))
      })
      return () => data.subscription.unsubscribe()
    },
  }
}