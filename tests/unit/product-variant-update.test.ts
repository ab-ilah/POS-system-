import { describe, expect, it } from 'vitest'
import {
  buildProductVariantUpdatePayload,
  friendlyProductError,
  PRODUCT_VARIANT_UPDATE_COLUMNS,
} from '../../src/lib/data/products.ts'
import { pesewas } from '../../src/lib/money.ts'

describe('product variant update payload', () => {
  it('sends exactly the RLS whitelist columns on update', () => {
    const payload = buildProductVariantUpdatePayload('prod-1', {
      sku: ' tee-m-wht ',
      size_name: 'M',
      colour_name: 'White',
      price_pesewas: pesewas(4550),
      low_stock_threshold: 5,
    })
    expect(Object.keys(payload).sort()).toEqual([...PRODUCT_VARIANT_UPDATE_COLUMNS].sort())
    expect(payload).toEqual({
      product_id: 'prod-1',
      sku: 'TEE-M-WHT',
      size_name: 'M',
      colour_name: 'White',
      price_pesewas: 4550,
      low_stock_threshold: 5,
    })
    expect(payload).not.toHaveProperty('stock_qty')
    expect(payload).not.toHaveProperty('id')
  })

  it('maps 42501 to friendly permission copy', () => {
    const err = new Error('permission denied')
    Object.assign(err, { code: '42501' })
    expect(friendlyProductError(err)).toMatch(/permission/i)
  })
})