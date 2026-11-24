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

function mountSession(
  role: 'cashier' | 'manager' | null,
  userId: string,
  onReady: (cart: ReturnType<typeof useSellCart>) => void,
) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <StaffSessionTestProvider role={role} userId={userId}>
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

  it('keys the cart by user id and clears the prior user on sign-out and switch', async () => {
    let sellCart: ReturnType<typeof useSellCart> | null = null
    const first = mountSession('cashier', 'user-cashier-a', (cart) => {
      sellCart = cart
    })

    await act(async () => {
      first.container.querySelector('button')?.click()
    })
    const cashierCartId = sellCart!.cart.id
    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}user-cashier-a`)).toBeTruthy()

    first.root.unmount()

    let afterSignOut: ReturnType<typeof useSellCart> | null = null
    const signedOut = mountSession(null, 'signed-out', (cart) => {
      afterSignOut = cart
    })

    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}user-cashier-a`)).toBeNull()
    expect(afterSignOut!.cart.lines).toHaveLength(0)
    expect(afterSignOut!.cart.id).not.toBe(cashierCartId)

    signedOut.root.unmount()

    let managerCart: ReturnType<typeof useSellCart> | null = null
    const switched = mountSession('manager', 'user-manager-b', (cart) => {
      managerCart = cart
    })
    await act(async () => {
      switched.container.querySelector('button')?.click()
    })
    const managerCartId = managerCart!.cart.id

    switched.root.unmount()

    let afterSwitch: ReturnType<typeof useSellCart> | null = null
    mountSession('cashier', 'user-cashier-c', (cart) => {
      afterSwitch = cart
    })

    expect(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}user-manager-b`)).toBeNull()
    expect(afterSwitch!.cart.lines).toHaveLength(0)
    expect(afterSwitch!.cart.id).not.toBe(managerCartId)
  })
})