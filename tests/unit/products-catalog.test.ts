import { describe, expect, it } from 'vitest'
import { demoListProducts, demoUpsertVariant } from '../../src/lib/data/demo-product-store.ts'
import { fetchProductList, friendlyProductError } from '../../src/lib/data/products.ts'
import { validateProductInput, validateVariantInput } from '../../src/lib/products/validation.ts'
import { pesewas, shelfPriceFromCedis } from '../../src/lib/money.ts'

describe('products catalogue', () => {
  it('filters demo products by search and SKU', () => {
    const byName = demoListProducts({ search: 'linen', category: 'all', includeArchived: false })
    expect(byName.map((product) => product.name)).toContain('Linen shirt')

    const bySku = demoListProducts({ search: 'TEE-M-WHT', category: 'all', includeArchived: false })
    expect(bySku).toHaveLength(1)
  })

  it('hides archived products unless the filter is on', () => {
    const activeOnly = demoListProducts({ search: '', category: 'all', includeArchived: false })
    expect(activeOnly.some((product) => product.name.includes('kaftan'))).toBe(false)
    const withArchived = demoListProducts({ search: 'kaftan', category: 'all', includeArchived: true })
    expect(withArchived.some((product) => !product.active)).toBe(true)
  })

  it('validates product and variant forms', () => {
    expect(validateProductInput({ name: '', category: 'shirts', description: '' }).name).toBeTruthy()
    expect(
      validateVariantInput({
        sku: 'A',
        size_name: 'M',
        colour_name: 'Red',
        price_pesewas: pesewas(-1),
        low_stock_threshold: -1,
      }),
    ).toMatchObject({
      price_pesewas: expect.any(String),
      low_stock_threshold: expect.any(String),
    })
  })

  it('maps duplicate SKU violations to friendly copy', () => {
    const err = new Error('duplicate key value')
    Object.assign(err, { code: '23505' })
    expect(friendlyProductError(err)).toMatch(/SKU is already in use/i)
  })

  it('rejects duplicate demo SKUs on create', () => {
    expect(() =>
      demoUpsertVariant('prod-tee', null, {
        sku: 'TEE-M-WHT',
        size_name: 'S',
        colour_name: 'Black',
        price_pesewas: shelfPriceFromCedis(10, 0),
        low_stock_threshold: 5,
      }),
    ).toThrow(/SKU/i)
  })

  it('loads demo list when Supabase is not configured', async () => {
    const rows = await fetchProductList({ search: '', category: 'all', includeArchived: false })
    expect(rows.length).toBeGreaterThan(0)
  })
})