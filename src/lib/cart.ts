import type { Pesewas } from './money.ts'
import type { SaleId, SaleLineId, StoreId, VariantId } from '../types/index.ts'

export type CartLine = {
  id: SaleLineId
  variantId: VariantId
  quantity: number
  unitPricePesewas: Pesewas
  /** Shelf label shown when the RPC names a variant id only. */
  label: string
}

export type Cart = {
  id: SaleId
  storeId: StoreId
  lines: readonly CartLine[]
}

export function cartLineLabels(cart: Cart): Map<string, string> {
  return new Map(cart.lines.map((line) => [line.variantId, line.label]))
}

export function regenerateCartLineIds(cart: Cart, newId: () => string = () => crypto.randomUUID()): Cart {
  return {
    ...cart,
    lines: cart.lines.map((line) => ({ ...line, id: newId() })),
  }
}

export function regenerateCartSaleId(cart: Cart, newId: () => string = () => crypto.randomUUID()): Cart {
  return { ...cart, id: newId() }
}

export function cloneCart(cart: Cart): Cart {
  return {
    id: cart.id,
    storeId: cart.storeId,
    lines: cart.lines.map((line) => ({ ...line })),
  }
}
