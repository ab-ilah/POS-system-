import { describe, expect, it } from 'vitest'
import { cloneCart, regenerateCartLineIds, type Cart } from '../../src/lib/cart.ts'
import { mapCommitSaleFailure } from '../../src/lib/commit-sale-errors.ts'
import { checkoutCart, type CheckoutResult } from '../../src/lib/checkout.ts'
import { CommitSaleRpcError } from '../../src/lib/data/commit-sale-rpc-error.ts'
import { CommitSaleTimeoutError } from '../../src/lib/data/commit-sale-call.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'
import type { CommitSaleClient } from '../../src/lib/data/sales.ts'

function rpcError(code: string, fields?: { details?: string; hint?: string; message?: string }) {
  return new CommitSaleRpcError({
    code,
    message: fields?.message ?? code,
    details: fields?.details,
    hint: fields?.hint,
  })
}

const sampleCart = (): Cart => ({
  id: 'sale-1',
  storeId: 'store-1',
  lines: [
    {
      id: 'line-1',
      variantId: 'var-shirt',
      quantity: 2,
      unitPricePesewas: shelfPriceFromCedis(189, 0),
      label: 'Oxford shirt',
    },
    {
      id: 'line-2',
      variantId: 'var-thread',
      quantity: 1,
      unitPricePesewas: shelfPriceFromCedis(1, 5),
      label: 'Thread spool',
    },
  ],
})

function mockClient(fn: CommitSaleClient['commitSale']): CommitSaleClient {
  return { commitSale: fn }
}

describe('mapCommitSaleFailure', () => {
  it('maps P0004 replay mismatch to a refresh message', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0004'))
    expect(mapped.code).toBe('P0004')
    expect(mapped.userMessage).toMatch(/conflicts with an earlier one/i)
    expect(mapped.regenerateLineIds).toBe(false)
  })

  it('maps P0005 duplicate line id and asks to regenerate line ids', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0005'))
    expect(mapped.code).toBe('P0005')
    expect(mapped.userMessage).toMatch(/line ids were assigned/i)
    expect(mapped.regenerateLineIds).toBe(true)
  })

  it('maps PSTCK using the hint as the item name', () => {
    const mapped = mapCommitSaleFailure(
      rpcError('PSTCK', { hint: 'Oxford shirt — navy · M', details: 'variant_id=var-shirt' }),
    )
    expect(mapped.code).toBe('PSTCK')
    expect(mapped.userMessage).toContain('Oxford shirt — navy · M')
    expect(mapped.regenerateLineIds).toBe(false)
  })

  it('maps P0002 to an unknown-item message', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0002'))
    expect(mapped.code).toBe('P0002')
    expect(mapped.userMessage).toMatch(/catalogue/i)
    expect(mapped.regenerateLineIds).toBe(false)
  })

  it('maps any other RPC code to the generic retry message', () => {
    const mapped = mapCommitSaleFailure(rpcError('XX999'))
    expect(mapped.code).toBe('generic')
    expect(mapped.userMessage).toBe('Something went wrong. Please try again.')
  })

  it('maps commit sale timeout to the generic retry message', () => {
    const mapped = mapCommitSaleFailure(new CommitSaleTimeoutError())
    expect(mapped.code).toBe('generic')
    expect(mapped.userMessage).toBe('Something went wrong. Please try again.')
  })
})

describe('checkoutCart', () => {
  it('treats replayed:true as success without duplicate success effects', async () => {
    const result = await checkoutCart(
      sampleCart(),
      mockClient(async () => ({ saleId: 'sale-1', replayed: true })),
      'cashier',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.replayed).toBe(true)
      expect(result.skipDuplicateSuccessEffects).toBe(true)
    }
  })

  it('preserves the cart on P0004', async () => {
    const before = sampleCart()
    const after: CheckoutResult = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0004')
      }),
      'cashier',
    )
    expect(after.ok).toBe(false)
    if (!after.ok) {
      expect(after.cart).toEqual(before)
    }
  })

  it('preserves cart lines but regenerates line ids on P0005', async () => {
    const before = sampleCart()
    const after = await checkoutCart(before, mockClient(async () => { throw rpcError('P0005') }), 'cashier')
    expect(after.ok).toBe(false)
    if (!after.ok) {
      expect(after.cart.lines).toHaveLength(2)
      expect(after.cart.lines.map((l) => l.variantId)).toEqual(before.lines.map((l) => l.variantId))
      expect(after.cart.lines.map((l) => l.id)).not.toEqual(before.lines.map((l) => l.id))
    }
  })

  it('preserves the cart on PSTCK', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => { throw rpcError('PSTCK', { hint: 'Oxford shirt' }) }),
      'cashier',
    )
    expect(after.ok).toBe(false)
    if (!after.ok) {
      expect(after.cart).toEqual(before)
      expect(after.userMessage).toContain('Oxford shirt')
    }
  })

  it('preserves the cart on P0002', async () => {
    const before = sampleCart()
    const after = await checkoutCart(before, mockClient(async () => { throw rpcError('P0002') }), 'cashier')
    expect(!after.ok && after.cart).toEqual(before)
  })

  it('preserves the cart on a generic RPC failure', async () => {
    const before = sampleCart()
    const after = await checkoutCart(before, mockClient(async () => { throw rpcError('P9999') }), 'cashier')
    expect(!after.ok && after.cart).toEqual(before)
  })
})

describe('regenerateCartLineIds', () => {
  it('only changes line ids', () => {
    const cart = sampleCart()
    const next = regenerateCartLineIds(cart, () => 'new-line-id')
    expect(next.id).toBe(cart.id)
    expect(next.lines.every((line) => line.id === 'new-line-id')).toBe(true)
    expect(cloneCart(cart)).toEqual(cart)
  })
})
