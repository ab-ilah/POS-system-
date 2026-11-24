import { describe, expect, it } from 'vitest'
import { pesewasFromCediInput, validateVariantInput } from '../../src/lib/products/validation.ts'
import { pesewas } from '../../src/lib/money.ts'

describe('product form validation', () => {
  it('parses decimal cedi input into pesewas', () => {
    expect(pesewasFromCediInput('12.50')).toBe(pesewas(1250))
    expect(pesewasFromCediInput('12', '50')).toBe(pesewas(1250))
  })

  it('rejects malformed decimals', () => {
    expect(pesewasFromCediInput('12.999')).toBeNull()
    expect(pesewasFromCediInput('abc')).toBeNull()
  })

  it('rejects non-integer low stock threshold', () => {
    const errors = validateVariantInput({
      sku: 'SKU-1',
      size_name: 'M',
      colour_name: 'Red',
      price_pesewas: pesewas(100),
      low_stock_threshold: 2.5,
    })
    expect(errors.low_stock_threshold).toBeTruthy()
  })
})