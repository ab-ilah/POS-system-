// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { StaffSessionTestProvider } from '../../src/app/staff-session.tsx'
import { SellCheckoutPanel } from '../../src/features/sell/sell-checkout.tsx'
import { useSellCart, SELL_CART_STORAGE_PREFIX } from '../../src/features/sell/use-sell-cart.ts'
import { cloneCart } from '../../src/lib/cart.ts'
import { checkoutCart } from '../../src/lib/checkout.ts'
import { CommitSaleRpcError } from '../../src/lib/data/commit-sale-rpc-error.ts'
import * as checkoutGateway from '../../src/lib/data/checkout-gateway.ts'
import * as variantPrices from '../../src/lib/data/variant-prices.ts'
import { pesewas, shelfPriceFromCedis } from '../../src/lib/money.ts'
import type { CommitSaleClient, CommitSaleResult } from '../../src/lib/data/sales.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function commitResult(overrides: Partial<CommitSaleResult> = {}): CommitSaleResult {
  return {
    saleId: 'sale-1',
    replayed: false,
    status: 'completed',
    totalPesewas: pesewas(4550),
    ...overrides,
  }
}

function Harness() {
  const sellCart = useSellCart()
  return <SellCheckoutPanel sellCart={sellCart} />
}

function mountHarness(userId = 'cashier-user-1') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <StaffSessionTestProvider role="cashier" userId={userId}>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </StaffSessionTestProvider>
      </QueryClientProvider>,
    )
  })
  return { container, root, queryClient }
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

describe('useSellCart idempotency with checkoutCart clones', () => {
  afterEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('preserves the sale id when replaceCart receives a checkoutCart clone', async () => {
    let sellCart: ReturnType<typeof useSellCart> | null = null
    function Probe() {
      sellCart = useSellCart()
      return null
    }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <StaffSessionTestProvider role="cashier" userId="user-a">
          <Probe />
        </StaffSessionTestProvider>,
      )
    })
    await act(async () => {
      sellCart!.addLine({
        variantId: 'demo-tee-m-white',
        label: 'tee',
        unitPricePesewas: shelfPriceFromCedis(45, 50),
      })
    })
    const idBefore = sellCart!.cart.id
    sellCart!.markCommitAttempt()
    const snapshot = cloneCart(sellCart!.cart)
    await act(async () => {
      sellCart!.replaceCart(snapshot)
    })
    expect(sellCart!.cart.id).toBe(idBefore)
    root.unmount()
  })

  it('keeps the sale id through unconfirmed checkout, Retry, and remount', async () => {
    const client: CommitSaleClient = {
      async commitSale() {
        return commitResult({ status: 'unknown', totalPesewas: pesewas(100) })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const first = mountHarness('persist-user')
    await addDemoLine(first.container)
    const idBefore = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}persist-user`) ?? '{}').id as string

    const pay = Array.from(first.container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })
    const idAfterFail = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}persist-user`) ?? '{}').id as string
    expect(idAfterFail).toBe(idBefore)

    const retry = Array.from(first.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')
    await act(async () => {
      retry?.click()
      await Promise.resolve()
    })
    const idAfterRetry = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}persist-user`) ?? '{}').id as string
    expect(idAfterRetry).toBe(idBefore)

    first.root.unmount()
    const second = mountHarness('persist-user')
    await act(async () => {})
    const idAfterRemount = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}persist-user`) ?? '{}').id as string
    expect(idAfterRemount).toBe(idBefore)
    second.root.unmount()
  })

  it('handles P0003 with refreshed price, confirmation gate, and the same sale id on the next Pay', async () => {
    const newPrice = shelfPriceFromCedis(49, 0)
    vi.spyOn(variantPrices, 'fetchVariantShelfPrices').mockResolvedValue(
      new Map([['demo-tee-m-white', newPrice]]),
    )

    let calls = 0
    const client: CommitSaleClient = {
      async commitSale(args) {
        calls += 1
        if (calls === 1) {
          throw new CommitSaleRpcError({
            code: 'P0003',
            message: 'unit price does not match shelf price',
            details: 'variant_id=demo-tee-m-white',
          })
        }
        expect(args.idempotencyKey).toBe(
          JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-user`) ?? '{}').id,
        )
        expect(args.lines[0]?.unitPricePesewas).toBe(newPrice)
        return commitResult({ totalPesewas: newPrice })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const { container, root } = mountHarness('price-user')
    await addDemoLine(container)
    const saleId = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-user`) ?? '{}').id as string

    const pay = () =>
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay()?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/shelf price changed/i)
    expect(pay()?.hasAttribute('disabled')).toBe(true)

    const accept = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Accept new price',
    )
    await act(async () => {
      accept?.click()
    })

    await act(async () => {
      pay()?.click()
      await Promise.resolve()
    })

    expect(calls).toBe(2)
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-user`) ?? '{}').id).toBe(saleId)
    root.unmount()
  })
})