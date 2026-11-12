import { describe, expect, it } from 'vitest'
import { cloneCart, regenerateCartLineIds, type Cart } from '../../src/lib/cart.ts'
import { mapCommitSaleFailure } from '../../src/lib/commit-sale-errors.ts'
import { checkoutCart } from '../../src/lib/checkout.ts'
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

const labels = new Map([
  ['var-shirt', 'Oxford shirt'],
  ['var-thread', 'Thread spool'],
])

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
  it('maps P0004 idempotency_key_reuse to a fresh-sale retry message', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0004', { message: 'idempotency_key_reuse' }))
    expect(mapped.code).toBe('P0004')
    expect(mapped.userMessage).toMatch(/already started with different items/i)
    expect(mapped.assignNewSaleId).toBe(true)
  })

  it('maps P0004 invalid sale line to cashier copy', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0004', { message: 'invalid sale line' }))
    expect(mapped.userMessage).toMatch(/could not be sent/i)
    expect(mapped.assignNewSaleId).toBe(false)
  })

  it('maps P0004 empty sale to cashier copy', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0004', { message: 'a sale needs at least one line' }))
    expect(mapped.userMessage).toMatch(/Add at least one item/i)
  })

  it('maps unknown P0004 messages to the replay-mismatch fallback', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0004', { message: 'payload drift' }))
    expect(mapped.userMessage).toMatch(/conflicts with an earlier one/i)
    expect(mapped.assignNewSaleId).toBe(false)
  })

  it('maps P0005 in plain cashier language without mentioning line ids', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0005', { message: 'duplicate sale line id' }))
    expect(mapped.code).toBe('P0005')
    expect(mapped.userMessage).toMatch(/Tap Pay again/i)
    expect(mapped.userMessage).not.toMatch(/line id/i)
    expect(mapped.regenerateLineIds).toBe(true)
  })

  it('maps PSTCK from hint only', () => {
    const mapped = mapCommitSaleFailure(
      rpcError('PSTCK', { message: 'insufficient stock', hint: 'Oxford shirt — navy · M' }),
      { lineLabelByVariantId: labels },
    )
    expect(mapped.userMessage).toContain('Oxford shirt — navy · M')
  })

  it('maps PSTCK from variant_id in details using the cart label', () => {
    const mapped = mapCommitSaleFailure(
      rpcError('PSTCK', {
        message: 'insufficient stock',
        details: 'variant_id=var-shirt',
      }),
      { lineLabelByVariantId: labels },
    )
    expect(mapped.userMessage).toContain('Oxford shirt')
    expect(mapped.userMessage).not.toContain('variant_id')
  })

  it('maps PSTCK without hint or resolvable variant to a generic stock message', () => {
    const mapped = mapCommitSaleFailure(rpcError('PSTCK', { message: 'insufficient stock' }), {
      lineLabelByVariantId: labels,
    })
    expect(mapped.userMessage).toMatch(/an item in the cart/i)
    expect(mapped.userMessage).not.toMatch(/variant_id/)
  })

  it('maps P0002 no such variant to an unknown-item message', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0002', { message: 'no such variant' }))
    expect(mapped.userMessage).toMatch(/catalogue/i)
  })

  it('maps P0002 no such store to unknown-shop copy', () => {
    const mapped = mapCommitSaleFailure(rpcError('P0002', { message: 'no such store' }))
    expect(mapped.userMessage).toMatch(/shop is not recognised/i)
    expect(mapped.userMessage).not.toMatch(/catalogue/i)
  })

  it('maps any other RPC code to the generic retry message', () => {
    const mapped = mapCommitSaleFailure(rpcError('XX999'))
    expect(mapped.code).toBe('generic')
    expect(mapped.userMessage).toBe('Something went wrong. Please try again.')
  })

  it('maps a plain Error to the generic retry message', () => {
    const mapped = mapCommitSaleFailure(new Error('network blew up'))
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
  it('treats replayed:true as success', async () => {
    const result = await checkoutCart(
      sampleCart(),
      mockClient(async () => ({ saleId: 'sale-1', replayed: true })),
      'cashier',
    )
    expect(result).toEqual({ ok: true, saleId: 'sale-1', replayed: true })
  })

  it('assigns a new sale id on P0004 idempotency_key_reuse but keeps the lines', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0004', { message: 'idempotency_key_reuse' })
      }),
      'cashier',
    )
    expect(after.ok).toBe(false)
    if (!after.ok) {
      expect(after.cart.id).not.toBe(before.id)
      expect(after.cart.lines).toEqual(before.lines)
    }
  })

  it('preserves the cart on P0004 invalid sale line', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0004', { message: 'invalid sale line' })
      }),
      'cashier',
    )
    expect(!after.ok && after.cart).toEqual(before)
  })

  it('preserves the cart on P0004 empty sale', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0004', { message: 'a sale needs at least one line' })
      }),
      'cashier',
    )
    expect(!after.ok && after.cart).toEqual(before)
  })

  it('preserves the cart on P0004 replay-mismatch fallback', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0004', { message: 'unknown p0004' })
      }),
      'cashier',
    )
    expect(!after.ok && after.cart).toEqual(before)
  })

  it('preserves cart lines but regenerates line ids on P0005', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0005', { message: 'duplicate sale line id' })
      }),
      'cashier',
    )
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
      mockClient(async () => {
        throw rpcError('PSTCK', { message: 'insufficient stock' })
      }),
      'cashier',
    )
    expect(!after.ok && after.cart).toEqual(before)
    if (!after.ok) {
      expect(after.userMessage).toMatch(/an item in the cart/i)
    }
  })

  it('preserves the cart on P0002 unknown item', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P0002', { message: 'no such variant' })
      }),
      'cashier',
    )
    expect(!after.ok && after.cart).toEqual(before)
  })

  it('preserves the cart on a generic RPC failure', async () => {
    const before = sampleCart()
    const after = await checkoutCart(
      before,
      mockClient(async () => {
        throw rpcError('P9999')
      }),
      'cashier',
    )
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
