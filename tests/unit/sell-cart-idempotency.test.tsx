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
import { CommitSaleTimeoutError } from '../../src/lib/data/commit-sale-call.ts'
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
  const accept = () =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Accept new price'),
      )

    await act(async () => {
      pay()?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/shelf price changed/i)
    expect(pay()?.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/New total:/i)
    expect(accept()?.hasAttribute('disabled')).toBe(false)

    await act(async () => {
      accept()?.click()
    })

    await act(async () => {
      pay()?.click()
      await Promise.resolve()
    })

    expect(calls).toBe(2)
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-user`) ?? '{}').id).toBe(saleId)
    root.unmount()
  })

  it('blocks Accept and Pay while shelf price refresh is in flight', async () => {
    type ShelfMap = Awaited<ReturnType<typeof variantPrices.fetchVariantShelfPrices>>
    let resolveRefresh: (value: ShelfMap) => void = () => {}
    const refreshPromise = new Promise<ShelfMap>((resolve) => {
      resolveRefresh = resolve
    })
    vi.spyOn(variantPrices, 'fetchVariantShelfPrices').mockReturnValue(refreshPromise)

    const client: CommitSaleClient = {
      async commitSale() {
        throw new CommitSaleRpcError({
          code: 'P0003',
          message: 'unit price does not match shelf price',
          details: 'variant_id=demo-tee-m-white',
        })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const { container, root } = mountHarness('price-inflight')
    await addDemoLine(container)

    const pay = () =>
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    const accept = () =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Accept new price'),
      )

    await act(async () => {
      pay()?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/Updating shelf prices/i)
    expect(pay()?.hasAttribute('disabled')).toBe(true)
    expect(accept()?.hasAttribute('disabled')).toBe(true)
    expect(container.querySelectorAll('button[aria-label^="Decrease"]')).toHaveLength(0)

    await act(async () => {
      resolveRefresh(new Map([['demo-tee-m-white', shelfPriceFromCedis(49, 0)]]))
      await refreshPromise
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/New total:/i)
    expect(accept()?.hasAttribute('disabled')).toBe(false)
    root.unmount()
  })

  it('locks the cart and offers Retry price refresh when shelf refresh fails', async () => {
    const newPrice = shelfPriceFromCedis(49, 0)
    const fetchMock = vi
      .spyOn(variantPrices, 'fetchVariantShelfPrices')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Map([['demo-tee-m-white', newPrice]]))

    const client: CommitSaleClient = {
      async commitSale() {
        throw new CommitSaleRpcError({
          code: 'P0003',
          message: 'unit price does not match shelf price',
          details: 'variant_id=demo-tee-m-white',
        })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const { container, root } = mountHarness('price-retry')
    await addDemoLine(container)
    const saleId = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-retry`) ?? '{}').id as string

    const pay = () =>
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')

    await act(async () => {
      pay()?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toMatch(/Could not load the latest shelf prices/i)
    expect(container.querySelectorAll('button[aria-label^="Decrease"]')).toHaveLength(0)
    const retryRefresh = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent === 'Retry price refresh',
    )
    expect(retryRefresh).toBeTruthy()

    await act(async () => {
      retryRefresh?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toMatch(/New total:/i)
    const accept = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Accept new price'),
    )
    await act(async () => {
      accept?.click()
    })
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-retry`) ?? '{}').id).toBe(saleId)
    root.unmount()
  })

  it('keeps the sale id through network timeout, Retry, and remount', async () => {
    const client: CommitSaleClient = {
      async commitSale() {
        throw new CommitSaleTimeoutError()
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const first = mountHarness('timeout-user')
    await addDemoLine(first.container)
    const idBefore = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}timeout-user`) ?? '{}').id as string

    const pay = Array.from(first.container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })

    const retry = Array.from(first.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockResolvedValue({
      ok: true,
      saleId: idBefore,
      replayed: false,
      status: 'completed',
      totalPesewas: pesewas(4550),
    })
    await act(async () => {
      retry?.click()
      await Promise.resolve()
    })
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}timeout-user`) ?? '{}').id).toBe(idBefore)

    first.root.unmount()
    const second = mountHarness('timeout-user')
    await act(async () => {})
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}timeout-user`) ?? '{}').id).toBe(idBefore)
    second.root.unmount()
  })

  it('keeps the sale id through P0004 idempotency conflict and remount', async () => {
    const client: CommitSaleClient = {
      async commitSale() {
        throw new CommitSaleRpcError({ code: 'P0004', message: 'idempotency_key_conflict' })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const first = mountHarness('conflict-user')
    await addDemoLine(first.container)
    const idBefore = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}conflict-user`) ?? '{}').id as string

    const pay = Array.from(first.container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
    })
    expect(first.container.textContent).toMatch(/Check the last receipt/i)
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}conflict-user`) ?? '{}').id).toBe(idBefore)

    first.root.unmount()
    const second = mountHarness('conflict-user')
    await act(async () => {})
    expect(JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}conflict-user`) ?? '{}').id).toBe(idBefore)
    second.root.unmount()
  })

  it('mints a new sale id when qty changes after accepting a P0003 refresh', async () => {
    const newPrice = shelfPriceFromCedis(49, 0)
    vi.spyOn(variantPrices, 'fetchVariantShelfPrices').mockResolvedValue(
      new Map([['demo-tee-m-white', newPrice]]),
    )
    const client: CommitSaleClient = {
      async commitSale() {
        throw new CommitSaleRpcError({
          code: 'P0003',
          message: 'unit price does not match shelf price',
          details: 'variant_id=demo-tee-m-white',
        })
      },
    }
    vi.spyOn(checkoutGateway, 'browserCheckoutCart').mockImplementation((cart, role) =>
      checkoutCart(cart, client, role),
    )

    const { container, root } = mountHarness('price-mint')
    await addDemoLine(container)
    const saleId = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-mint`) ?? '{}').id as string

    const pay = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pay')
    await act(async () => {
      pay?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const accept = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Accept new price'),
    )
    await act(async () => {
      accept?.click()
    })

    const increase = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label')?.startsWith('Increase'),
    )
    await act(async () => {
      increase?.click()
    })

    const idAfterQty = JSON.parse(localStorage.getItem(`${SELL_CART_STORAGE_PREFIX}price-mint`) ?? '{}').id as string
    expect(idAfterQty).not.toBe(saleId)
    root.unmount()
  })
})