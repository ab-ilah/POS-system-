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

async function addDemoLine(container: HTMLElement) {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('summary')?.click()
  })
  const quickAdd = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Basic cotton tee'),
  )
  await act(async () => {
    quickAdd?.click()
  })
}

describe('SellCheckoutPanel states', () => {
  beforeEach(() => {
    localStorage.clear()
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.open = true
      }
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.open = false
      }
    }
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('exposes exactly one Pay control and no tender or split UI (AC1)', async () => {
    const { container, root } = mount(<Harness />)
    await addDemoLine(container)
    const payLabels = Array.from(container.querySelectorAll('button')).filter(
      (button) => button.textContent?.replace(/\s+/g, ' ').trim() === 'Pay',
    )
    expect(payLabels).toHaveLength(1)
    expect(container.textContent).not.toMatch(/tender|split payment/i)
    root.unmount()
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
    await addDemoLine(container)
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
    await addDemoLine(container)
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

  it('Retry reuses the same cart id and keeps lines locked', async () => {
    const checkout = vi.spyOn(checkoutGateway, 'browserCheckoutCart')
    checkout.mockImplementation(async (cart) => {
      if (checkout.mock.calls.length <= 1) {
        return {
          ok: false,
          kind: 'unconfirmed',
          userMessage: "We couldn't confirm this sale. Check Sales before taking payment again.",
          cart,
        }
      }
      return {
        ok: true,
        saleId: cart.id,
        replayed: true,
        status: 'completed',
        totalPesewas: pesewas(4550),
      }
    })

    const { container, root } = mount(<Harness />)
    await addDemoLine(container)
    const saleIdBeforePay = JSON.parse(localStorage.getItem('pos-sell-cart:cashier') ?? '{}').id as string

    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    expect(container.querySelectorAll('button[aria-label^="Decrease"]')).toHaveLength(0)

    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')
    await act(async () => {
      retry?.click()
      await Promise.resolve()
    })

    expect(checkout).toHaveBeenCalledTimes(2)
    expect(checkout.mock.calls[0]?.[0].id).toBe(saleIdBeforePay)
    expect(checkout.mock.calls[1]?.[0].id).toBe(saleIdBeforePay)
    expect(checkout.mock.calls[1]?.[0]).toBe(checkout.mock.calls[0]?.[0])
    expect(container.querySelectorAll('button[aria-label^="Decrease"]')).toHaveLength(0)
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
    await addDemoLine(container)
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

  it('focuses Cancel when the P0004 dialog opens and preserves the idempotency key until Confirm', async () => {
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: false,
      kind: 'error',
      userMessage:
        'An earlier sale from this cart was already recorded with different items. Check the last receipt before taking payment again.',
      code: 'P0004',
      idempotencyReuse: true,
      cart: {
        id: 'sale-conflict-1',
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
    await addDemoLine(container)

    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    const conflictId = JSON.parse(localStorage.getItem('pos-sell-cart:cashier') ?? '{}').id as string
    expect(conflictId).toBe('sale-conflict-1')

    const ring = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Ring as new sale'),
    )
    await act(async () => {
      ring?.click()
    })

    const cancel = container.querySelector<HTMLButtonElement>('dialog button')
    expect(cancel?.textContent).toBe('Cancel')
    expect(document.activeElement).toBe(cancel)

    await act(async () => {
      cancel?.click()
    })
    const idAfterCancel = JSON.parse(localStorage.getItem('pos-sell-cart:cashier') ?? '{}').id as string
    expect(idAfterCancel).toBe(conflictId)

    await act(async () => {
      ring?.click()
    })
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('dialog button')).find((button) =>
      button.textContent?.includes('Ring as new sale'),
    )
    await act(async () => {
      confirm?.click()
    })
    const idAfterConfirm = JSON.parse(localStorage.getItem('pos-sell-cart:cashier') ?? '{}').id as string
    expect(idAfterConfirm).not.toBe(conflictId)

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
    await addDemoLine(container)
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