import type { Cart } from '../cart.ts'
import { checkoutCart, type CheckoutResult } from '../checkout.ts'
import type { Role } from '../../types/index.ts'
import { createCommitSaleClient } from './supabase.ts'
import { browserSupabase } from './supabase.ts'

const NOT_CONFIGURED = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

export async function browserCheckoutCart(cart: Cart, role: Role = 'cashier'): Promise<CheckoutResult> {
  const supabase = browserSupabase()
  if (!supabase) {
    return { ok: false, userMessage: NOT_CONFIGURED, cart }
  }
  return checkoutCart(cart, createCommitSaleClient(supabase), role)
}
