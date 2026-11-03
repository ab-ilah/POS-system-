import { browserSupabase } from './supabase.ts'
import type { AuthGateway } from './types.ts'

export type SignInResult = { ok: true } | { ok: false; message: string }

const NOT_CONFIGURED = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

export async function signIn(
  credentials: { email: string; password: string },
  auth: AuthGateway | null,
): Promise<SignInResult> {
  if (!auth) return { ok: false, message: NOT_CONFIGURED }
  const { error } = await auth.signInWithPassword(credentials)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export function browserAuthGateway(): AuthGateway | null {
  const client = browserSupabase()
  if (!client) return null
  return {
    async signInWithPassword(credentials) {
      const { error } = await client.auth.signInWithPassword(credentials)
      return { error: error ? { message: error.message } : null }
    },
  }
}
