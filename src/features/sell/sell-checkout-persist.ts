import type { Cart } from '@/lib/cart.ts'

export type CheckoutPhase =
  | 'editing'
  | 'committing'
  | 'success'
  | 'voided'
  | 'conflict'
  | 'unconfirmed'
  | 'network'
  | 'price_confirm'

export const SELL_CHECKOUT_STATE_PREFIX = 'pos-sell-checkout:'

export type PersistedPriceRefreshStatus = 'loading' | 'ready' | 'error'

export type PersistedCheckoutState = {
  cartId: string
  phase: CheckoutPhase
  errorMessage: string | null
  priceRefreshStatus: PersistedPriceRefreshStatus | 'idle'
  priceRefreshContext: {
    cart: Cart
    variantIds: readonly string[]
    userMessage: string
  } | null
}

function storageKey(sessionKey: string): string {
  return `${SELL_CHECKOUT_STATE_PREFIX}${sessionKey}`
}

export function readPersistedCheckoutState(sessionKey: string, cartId: string): PersistedCheckoutState | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedCheckoutState
    if (!parsed || parsed.cartId !== cartId || parsed.phase !== 'price_confirm') return null
    return parsed
  } catch {
    return null
  }
}

export function writePersistedCheckoutState(sessionKey: string, state: PersistedCheckoutState | null): void {
  if (!state || state.phase !== 'price_confirm') {
    localStorage.removeItem(storageKey(sessionKey))
    return
  }
  localStorage.setItem(storageKey(sessionKey), JSON.stringify(state))
}