import { roleFromAppMetadata } from '../permissions.ts'
import type { Role } from '../../shared/permissions.matrix.ts'
import { browserSupabase } from './supabase.ts'

export type StaffSession = { role: Role }

export type SessionReader = {
  getStaffSession(): Promise<StaffSession | null>
  onStaffSessionChange(listener: (session: StaffSession | null) => void): () => void
}

function staffSessionFromAppMetadata(appMetadata: unknown): StaffSession | null {
  const role = roleFromAppMetadata(appMetadata)
  return role ? { role } : null
}

export function browserSessionReader(): SessionReader | null {
  const client = browserSupabase()
  if (!client) return null
  return {
    async getStaffSession() {
      const { data } = await client.auth.getSession()
      return staffSessionFromAppMetadata(data.session?.user.app_metadata)
    },
    onStaffSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(staffSessionFromAppMetadata(session?.user.app_metadata))
      })
      void client.auth.getSession().then(({ data: sessionData }) => {
        listener(staffSessionFromAppMetadata(sessionData.session?.user.app_metadata))
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
