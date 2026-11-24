// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { addCartLine, createCart } from '../../src/lib/cart.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'

const STORAGE_PREFIX = 'pos-sell-cart:'

function seedCart(role: string) {
  const cart = addCartLine(createCart('demo-store-1'), {
    variantId: 'var-1',
    label: 'Demo item',
    unitPricePesewas: shelfPriceFromCedis(10, 0),
  })
  localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(cart))
  return cart
}

describe('sell cart local storage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('clears stored cart and idempotency key when the session key changes (sign-out / switch user)', () => {
    seedCart('cashier')
    expect(localStorage.getItem(`${STORAGE_PREFIX}cashier`)).toBeTruthy()

    localStorage.removeItem(`${STORAGE_PREFIX}cashier`)
    const next = createCart('demo-store-1')
    localStorage.setItem(`${STORAGE_PREFIX}signed-out`, JSON.stringify(next))

    expect(localStorage.getItem(`${STORAGE_PREFIX}cashier`)).toBeNull()
    expect(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}signed-out`) ?? '')).toMatchObject({
      id: next.id,
      lines: [],
    })
  })
})