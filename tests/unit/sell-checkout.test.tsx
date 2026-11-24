// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSessionTestProvider } from '../../src/app/staff-session.tsx'
import { SellCheckoutPanel } from '../../src/features/sell/sell-checkout.tsx'
import { useSellCart } from '../../src/features/sell/use-sell-cart.ts'
import * as checkoutGateway from '../../src/lib/data/checkout-gateway.ts'
import { shelfPriceFromCedis, pesewas } from '../../src/lib/money.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  const sellCart = useSellCart()
  return <SellCheckoutPanel sellCart={sellCart} />
}

function mount(ui: ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <StaffSessionTestProvider role="cashier">
        <MemoryRouter>{ui}</MemoryRouter>
      </StaffSessionTestProvider>,
    )
  })
  return { container, root }
}

describe('SellCheckoutPanel states', () => {
  beforeEach(() => {
  localStorage.clear()
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('shows success with server total and New sale', async () => {
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: true,
      saleId: 'sale-1',
      replayed: false,
      status: 'completed',
      totalPesewas: pesewas(18099),
    })

    const { container, root } = mount(<Harness />)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('summary')?.click()
    })
    const quickAdd = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Basic cotton tee'),
    )
    await act(async () => {
      quickAdd?.click()
    })
    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/Sale recorded/)
    expect(container.textContent).toMatch(/GH₵180\.99/)
    expect(container.textContent).toMatch(/New sale/)
    root.unmount()
  })

  it('shows unconfirmed copy with Open Sales and Retry', async () => {
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: false,
      kind: 'unconfirmed',
      userMessage: "We couldn't confirm this sale. Check Sales before taking payment again.",
      cart: {
        id: 'sale-1',
        storeId: 'demo-store-1',
        lines: [
          {
            id: 'line-1',
            variantId: 'demo-tee-m-white',
            label: 'Basic cotton tee, M · White',
            quantity: 1,
            unitPricePesewas: shelfPriceFromCedis(45, 50),
          },
        ],
      },
    })

    const { container, root } = mount(<Harness />)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('summary')?.click()
    })
    const quickAdd = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Basic cotton tee'),
    )
    await act(async () => {
      quickAdd?.click()
    })
    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/couldn't confirm this sale/i)
    expect(container.textContent).toMatch(/Open Sales/)
    expect(container.textContent).toMatch(/Retry/)
    root.unmount()
  })

  it('shows P0004 conflict copy and ring-as-new-sale confirm dialog', async () => {
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: false,
      kind: 'error',
      userMessage:
        'An earlier sale from this cart was already recorded with different items. Check the last receipt before taking payment again.',
      code: 'P0004',
      idempotencyReuse: true,
      cart: {
        id: 'sale-1',
        storeId: 'demo-store-1',
        lines: [
          {
            id: 'line-1',
            variantId: 'demo-tee-m-white',
            label: 'Basic cotton tee, M · White',
            quantity: 1,
            unitPricePesewas: shelfPriceFromCedis(45, 50),
          },
        ],
      },
    })

    const { container, root } = mount(<Harness />)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('summary')?.click()
    })
    const quickAdd = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Basic cotton tee'),
    )
    await act(async () => {
      quickAdd?.click()
    })
    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/Check the last receipt/)
    expect(container.textContent).toMatch(/View last sale/)
    const ring = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Ring as new sale'),
    )
    await act(async () => {
      ring?.click()
    })
    expect(container.textContent).toMatch(/Ring this as a new sale\?/)
    root.unmount()
  })

  it('shows generic network fallback with Retry only', async () => {
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: false,
      kind: 'error',
      userMessage: 'Something went wrong. Please try again.',
      code: 'generic',
      idempotencyReuse: false,
      cart: {
        id: 'sale-1',
        storeId: 'demo-store-1',
        lines: [
          {
            id: 'line-1',
            variantId: 'demo-tee-m-white',
            label: 'Basic cotton tee, M · White',
            quantity: 1,
            unitPricePesewas: shelfPriceFromCedis(45, 50),
          },
        ],
      },
    })

    const { container, root } = mount(<Harness />)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('summary')?.click()
    })
    const quickAdd = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Basic cotton tee'),
    )
    await act(async () => {
      quickAdd?.click()
    })
    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/Something went wrong/)
    const retryButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'Retry')
    expect(retryButtons).toHaveLength(1)
    root.unmount()
  })
})