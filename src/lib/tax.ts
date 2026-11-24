import { pesewas, sumPesewas, type Pesewas } from './money.ts'

export type TaxBreakdown = {
  grossPesewas: Pesewas
  netPesewas: Pesewas
  vatPesewas: Pesewas
  nhilPesewas: Pesewas
  getfundPesewas: Pesewas
  totalTaxPesewas: Pesewas
}

/** POS-03 net-first breakdown on the sum of tax-inclusive line grosses (no discounts). */
export function taxBreakdownFromGross(grossPesewas: Pesewas): TaxBreakdown {
  const gross = pesewas(grossPesewas)
  const netPesewas = pesewas(Math.round(gross / 1.2))
  const vatPesewas = pesewas(Math.round(netPesewas * 0.15))
  const nhilPesewas = pesewas(Math.round(netPesewas * 0.025))
  const getfundPesewas = pesewas(Math.round(netPesewas * 0.025))
  const totalTaxPesewas = sumPesewas([vatPesewas, nhilPesewas, getfundPesewas])
  return {
    grossPesewas: gross,
    netPesewas,
    vatPesewas,
    nhilPesewas,
    getfundPesewas,
    totalTaxPesewas,
  }
}