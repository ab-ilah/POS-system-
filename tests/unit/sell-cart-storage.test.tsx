// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { StaffSessionTestProvider } from '../../src/app/staff-session.tsx'
import { useSellCart, SELL_CART_STORAGE_PREFIX } from '../../src/features/sell/use-sell-cart.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function SellCartHarness({ onReady }: { onReady: (cart: ReturnType<typeof useSellCart>) => void }) {
  const sellCart = useSellCart()
  onReady(sellCart)
  return (
    <button
      type="button"
      onClick={() =>
        sellCart.addLine({
          variantId: 'var-1',
          label: 'Demo item',
          unitPricePesewas: shelfPriceFromCedis(10, 0),
        })
      }
    >
      Add line
    </button>
  )
}

function mountSession(role: 'cashier' | 'manager' | null, onReady: (cart: ReturnType<typeof useSellCart>) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <StaffSessionTestProvider role={role}>
        <SellCartHarness onReady={onReady} />
      </StaffSessionTestProvider>,
    )
  })
  return { container, root }
}

describe('useSellCart session storage (AC6)', () => {
  afterEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
  })

  it('clears the prior role storage key and empties the cart on sign-out and on role switch', async () => {
    let sellCart: ReturnType<typeof useSellCart> | null = null
    const first = mountSession('cashier', (cart) => {
      sellCart = cart
    })

    await act(async () => {
      first.container.querySelector('button')?.click()
    })
    const cashierCartId = sellCart!.cart.id
    expect(sellCart!.cart.lines).toHaveLength(1)
    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}cashier`)).toBeTruthy()

    first.root.unmount()

    let afterSignOut: ReturnType<typeof useSellCart> | null = null
    const signedOut = mountSession(null, (cart) => {
      afterSignOut = cart
    })

    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}cashier`)).toBeNull()
    expect(afterSignOut!.cart.lines).toHaveLength(0)
    expect(afterSignOut!.cart.id).not.toBe(cashierCartId)

    signedOut.root.unmount()

    let managerCart: ReturnType<typeof useSellCart> | null = null
    const switched = mountSession('manager', (cart) => {
      managerCart = cart
    })
    await act(async () => {
      switched.container.querySelector('button')?.click()
    })
    const managerCartId = managerCart!.cart.id
    expect(managerCart!.cart.lines).toHaveLength(1)

    switched.root.unmount()

    let afterSwitch: ReturnType<typeof useSellCart> | null = null
    mountSession('cashier', (cart) => {
      afterSwitch = cart
    })

    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}manager`)).toBeNull()
    expect(afterSwitch!.cart.lines).toHaveLength(0)
    expect(afterSwitch!.cart.id).not.toBe(managerCartId)
  })
})