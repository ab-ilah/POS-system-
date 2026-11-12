import type { Cart } from '../cart.ts'
import { checkoutCart, type CheckoutResult } from '../checkout.ts'
import type { Role } from '../../types/index.ts'
import { browserSupabase, createCommitSaleClient } from './supabase.ts'

const NOT_CONFIGURED = 'The till cannot reach the server right now. Try again in a moment.'

export async function browserCheckoutCart(cart: Cart, role: Role): Promise<CheckoutResult> {
  const supabase = browserSupabase()
  if (!supabase) {
    return { ok: false, userMessage: NOT_CONFIGURED, cart }
  }
  return checkoutCart(cart, createCommitSaleClient(supabase), role)
}
