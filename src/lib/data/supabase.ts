import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createRowStore } from './row-store.ts'
import type { QueryClientLike, RowStore } from './types.ts'

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export function readSupabaseEnv(env: SupabaseEnv = import.meta.env): { url: string; anonKey: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null
}

export function createSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function createSupabaseRowStore(client: SupabaseClient): RowStore {
  return createRowStore(client as unknown as QueryClientLike)
}

export function browserSupabase(): SupabaseClient | null {
  const env = readSupabaseEnv()
  if (!env) return null
  return createSupabaseBrowserClient(env.url, env.anonKey)
}
