import { describe, expect, it } from 'vitest'
import {
  addPesewas,
  formatGhs,
  lineTotal,
  parseGhs,
  pesewas,
  shelfPriceFromCedis,
  sumPesewas,
} from '../../src/lib/money.ts'

describe('pesewas', () => {
  it('rejects fractional money', () => {
    expect(() => pesewas(0.1)).toThrow(/integer number of pesewas/)
    expect(() => pesewas(10.5)).toThrow(/integer number of pesewas/)
    expect(() => pesewas(Number.NaN)).toThrow(/integer number of pesewas/)
  })

  it('accepts negative integers for adjustments and zero for an empty total', () => {
    expect(pesewas(0)).toBe(0)
    expect(pesewas(-50)).toBe(-50)
  })
})

describe('shelf prices', () => {
  it('builds a tax-inclusive shelf price from whole cedis and pesewas', () => {
    expect(shelfPriceFromCedis(189, 0)).toBe(18900)
    expect(shelfPriceFromCedis(1, 5)).toBe(105)
  })

  it('rejects fractional cedis, negative shelf prices, and a pesewa part above 99', () => {
    expect(() => shelfPriceFromCedis(1.5, 0)).toThrow(/non-negative integer/)
    expect(() => shelfPriceFromCedis(-1, 0)).toThrow(/non-negative integer/)
    expect(() => shelfPriceFromCedis(1, 100)).toThrow(/0 to 99/)
  })
})

describe('formatGhs', () => {
  it('formats integer pesewas as Ghana cedis without floating-point residue', () => {
    expect(formatGhs(pesewas(0))).toBe('GH₵ 0.00')
    expect(formatGhs(pesewas(1))).toBe('GH₵ 0.01')
    expect(formatGhs(pesewas(10))).toBe('GH₵ 0.10')
    expect(formatGhs(pesewas(18900))).toBe('GH₵ 189.00')
    expect(formatGhs(pesewas(123456789))).toBe('GH₵ 1,234,567.89')
    expect(formatGhs(pesewas(-50))).toBe('-GH₵ 0.50')
  })

  it('formats and parses 99, 100, and 123456 pesewas as GH₵', () => {
    expect(formatGhs(pesewas(99))).toBe('GH₵ 0.99')
    expect(formatGhs(pesewas(100))).toBe('GH₵ 1.00')
    expect(formatGhs(pesewas(123456))).toBe('GH₵ 1,234.56')
    expect(parseGhs('GH₵ 0.99')).toBe(99)
    expect(parseGhs('GH₵ 1.00')).toBe(100)
    expect(parseGhs('GH₵ 1,234.56')).toBe(123456)
    expect(parseGhs(formatGhs(pesewas(99)))).toBe(99)
    expect(parseGhs(formatGhs(pesewas(100)))).toBe(100)
    expect(parseGhs(formatGhs(pesewas(123456)))).toBe(123456)
  })
})

describe('arithmetic', () => {
  it('adds and multiplies in integer pesewas', () => {
    expect(addPesewas(pesewas(18900), pesewas(105))).toBe(19005)
    expect(sumPesewas([pesewas(100), pesewas(250), pesewas(1)])).toBe(351)
    expect(lineTotal(shelfPriceFromCedis(189, 0), 2)).toBe(37800)
  })

  it('rejects a non-integer or non-positive quantity', () => {
    expect(() => lineTotal(pesewas(100), 1.5)).toThrow(/whole number/)
    expect(() => lineTotal(pesewas(100), 0)).toThrow(/whole number/)
    expect(() => lineTotal(pesewas(-100), 1)).toThrow(/negative/)
  })
})
