import { describe, expect, it } from 'vitest'
import { formatGhs, pesewas } from '../../src/lib/money.ts'
import { taxBreakdownFromGross } from '../../src/lib/tax.ts'

describe('taxBreakdownFromGross (POS-03 E5)', () => {
  it('matches the E5 receipt breakdown', () => {
    const breakdown = taxBreakdownFromGross(pesewas(18099))
    expect(formatGhs(breakdown.netPesewas)).toBe('GH₵150.83')
    expect(formatGhs(breakdown.vatPesewas)).toBe('GH₵22.62')
    expect(formatGhs(breakdown.nhilPesewas)).toBe('GH₵3.77')
    expect(formatGhs(breakdown.getfundPesewas)).toBe('GH₵3.77')
    expect(formatGhs(breakdown.grossPesewas)).toBe('GH₵180.99')
  })
})