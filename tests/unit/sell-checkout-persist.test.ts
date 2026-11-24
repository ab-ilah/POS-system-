// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  readPersistedCheckoutState,
  SELL_CHECKOUT_STATE_PREFIX,
  writePersistedCheckoutState,
} from '../../src/features/sell/sell-checkout-persist.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'

describe('sell checkout persistence', () => {
  it('stores price_confirm state per session and restores for the same cart id', () => {
    const cart = {
      id: 'sale-persist-1',
      storeId: 'demo-store-1',
      lines: [
        {
          id: 'line-1',
          variantId: 'demo-tee-m-white',
          label: 'tee',
          quantity: 1,
          unitPricePesewas: shelfPriceFromCedis(45, 50),
        },
      ],
    }
    writePersistedCheckoutState('user-1', {
      cartId: cart.id,
      phase: 'price_confirm',
      errorMessage: 'The shelf price changed.',
      priceRefreshStatus: 'ready',
      priceRefreshContext: { cart, variantIds: ['demo-tee-m-white'], userMessage: 'The shelf price changed.' },
    })

    const restored = readPersistedCheckoutState('user-1', cart.id)
    expect(restored?.phase).toBe('price_confirm')
    expect(restored?.priceRefreshStatus).toBe('ready')

    expect(readPersistedCheckoutState('user-1', 'other-sale')).toBeNull()
    localStorage.removeItem(`${SELL_CHECKOUT_STATE_PREFIX}user-1`)
  })
})