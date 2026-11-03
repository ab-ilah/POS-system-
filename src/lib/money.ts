const dbIntegerBrand = Symbol('DbInteger')
const pesewasBrand = Symbol('Pesewas')

export type DbInteger = number & { readonly [dbIntegerBrand]: true }
export type Pesewas = DbInteger & { readonly [pesewasBrand]: true }

export function dbInteger(amount: number): DbInteger {
  if (!Number.isSafeInteger(amount)) {
    throw new Error('Value must be a safe integer')
  }
  return amount as DbInteger
}

export function pesewas(amount: number): Pesewas {
  if (!Number.isSafeInteger(amount)) {
    throw new Error('Money must be an integer number of pesewas')
  }
  return dbInteger(amount) as Pesewas
}

export function shelfPriceFromCedis(cedis: number, extraPesewas = 0): Pesewas {
  if (!Number.isInteger(cedis) || cedis < 0) {
    throw new Error('Cedis must be a non-negative integer')
  }
  if (!Number.isInteger(extraPesewas) || extraPesewas < 0 || extraPesewas > 99) {
    throw new Error('Pesewas must be an integer from 0 to 99')
  }
  return pesewas(cedis * 100 + extraPesewas)
}

export function addPesewas(left: Pesewas, right: Pesewas): Pesewas {
  const sum = left + right
  if (!Number.isSafeInteger(sum)) {
    throw new Error('Money sum is out of range')
  }
  return pesewas(sum)
}

export function sumPesewas(amounts: readonly Pesewas[]): Pesewas {
  return amounts.reduce((total, amount) => addPesewas(total, amount), pesewas(0))
}

export function lineTotal(unitPricePesewas: Pesewas, quantity: number): Pesewas {
  if (unitPricePesewas < 0) {
    throw new Error('Shelf prices cannot be negative')
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive whole number')
  }
  const total = unitPricePesewas * quantity
  if (!Number.isSafeInteger(total)) {
    throw new Error('Line total is out of range')
  }
  return pesewas(total)
}

function groupCedis(cedis: number): string {
  return String(cedis).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatGhs(amount: Pesewas): string {
  const value = pesewas(amount)
  const negative = value < 0
  const absolute = negative ? -value : value
  const cedis = Math.trunc(absolute / 100)
  const fraction = absolute % 100
  const formatted = `GHS ${groupCedis(cedis)}.${String(fraction).padStart(2, '0')}`
  return negative ? `-${formatted}` : formatted
}
