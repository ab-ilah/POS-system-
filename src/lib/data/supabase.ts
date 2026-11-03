import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.ts'
import type { CommitSaleArgs, CommitSaleClient, CommitSaleResult } from './sales.ts'

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export type TypedSupabaseClient = SupabaseClient<Database>

export function readSupabaseEnv(env: SupabaseEnv = import.meta.env): { url: string; anonKey: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null
}

export function createSupabaseBrowserClient(url: string, anonKey: string): TypedSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function browserSupabase(): TypedSupabaseClient | null {
  const env = readSupabaseEnv()
  if (!env) return null
  return createSupabaseBrowserClient(env.url, env.anonKey)
}

function commitSaleResult(data: Database['public']['Functions']['commit_sale']['Returns'] | null): CommitSaleResult {
  if (!data || typeof data.sale_id !== 'string' || typeof data.replayed !== 'boolean') {
    throw new Error('commit_sale returned an unexpected payload')
  }
  return { saleId: data.sale_id, replayed: data.replayed }
}

export function createCommitSaleClient(client: TypedSupabaseClient): CommitSaleClient {
  return {
    async commitSale(args: CommitSaleArgs) {
      const { data, error } = await client.rpc('commit_sale', {
        p_idempotency_key: args.idempotencyKey,
        p_store_id: args.storeId,
        p_lines: args.lines.map((line) => ({
          id: line.id,
          variant_id: line.variantId,
          quantity: line.quantity,
          unit_price_pesewas: line.unitPricePesewas,
        })),
      })
      if (error) throw new Error(error.message)
      return commitSaleResult(data)
    },
  }
}
