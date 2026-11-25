import { lineTotal, pesewas, sumPesewas, type Pesewas } from './money.ts'
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

export function createCart(storeId: StoreId, newId: () => string = () => crypto.randomUUID()): Cart {
  return { id: newId(), storeId, lines: [] }
}

export function cartGrossPesewas(cart: Cart): Pesewas {
  return sumPesewas(cart.lines.map((line) => lineTotal(line.unitPricePesewas, line.quantity)))
}

export type CartLineInput = {
  variantId: VariantId
  label: string
  unitPricePesewas: Pesewas
  quantity?: number
}

export function addCartLine(
  cart: Cart,
  input: CartLineInput,
  newId: () => string = () => crypto.randomUUID(),
): Cart {
  const existing = cart.lines.find((line) => line.variantId === input.variantId)
  if (existing) {
    return setCartLineQuantity(cart, existing.id, existing.quantity + (input.quantity ?? 1))
  }
  return {
    ...cart,
    lines: [
      ...cart.lines,
      {
        id: newId(),
        variantId: input.variantId,
        label: input.label,
        unitPricePesewas: input.unitPricePesewas,
        quantity: input.quantity ?? 1,
      },
    ],
  }
}

export function setCartLineQuantity(cart: Cart, lineId: SaleLineId, quantity: number): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ...cart,
      lines: cart.lines.filter((line) => line.id !== lineId),
    }
  }
  return {
    ...cart,
    lines: cart.lines.map((line) => (line.id === lineId ? { ...line, quantity } : line)),
  }
}

export function updateCartLineShelfPrices(cart: Cart, prices: ReadonlyMap<string, Pesewas>): Cart {
  return applyCartLineShelfPrices(cart, prices).cart
}

export function applyCartLineShelfPrices(
  cart: Cart,
  prices: ReadonlyMap<string, Pesewas>,
): { cart: Cart; missingVariantIds: VariantId[] } {
  const missingVariantIds: VariantId[] = []
  const lines = cart.lines.map((line) => {
    const nextPrice = prices.get(line.variantId)
    if (nextPrice == null) {
      missingVariantIds.push(line.variantId)
      return line
    }
    return { ...line, unitPricePesewas: pesewas(nextPrice) }
  })
  return { cart: { ...cart, lines }, missingVariantIds }
}

export function changeCartLineQuantity(cart: Cart, lineId: SaleLineId, delta: number): Cart {
  const line = cart.lines.find((entry) => entry.id === lineId)
  if (!line) return cart
  return setCartLineQuantity(cart, lineId, line.quantity + delta)
}

export function cartsEqual(left: Cart, right: Cart): boolean {
  if (left.id !== right.id || left.storeId !== right.storeId || left.lines.length !== right.lines.length) {
    return false
  }
  return left.lines.every((line, index) => {
    const other = right.lines[index]
    return (
      other != null &&
      line.id === other.id &&
      line.variantId === other.variantId &&
      line.quantity === other.quantity &&
      line.unitPricePesewas === other.unitPricePesewas &&
      line.label === other.label
    )
  })
}

/** After any deliberate line edit following a commit attempt, mint a fresh sale id (PR #14 / POS-02e). */
export function cartAfterLineEdit(cart: Cart, next: Cart): Cart {
  if (cartsEqual(cart, next)) return next
  if (next.id === cart.id) {
    return { ...next, id: crypto.randomUUID() }
  }
  return next
}
