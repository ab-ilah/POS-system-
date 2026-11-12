import { mapCommitSaleFailure } from './commit-sale-errors.ts'
import { cartLineLabels, cloneCart, regenerateCartLineIds, type Cart } from './cart.ts'
import { commitSale, prepareSale, type CommitSaleClient, type CommitSaleResult } from './data/sales.ts'
import type { Role } from '../types/index.ts'

export type CheckoutSuccess = {
  ok: true
  saleId: string
  replayed: boolean
  /** When true, skip one-off success effects such as printing a second receipt. */
  skipDuplicateSuccessEffects: boolean
}

export type CheckoutFailure = {
  ok: false
  userMessage: string
  cart: Cart
}

export type CheckoutResult = CheckoutSuccess | CheckoutFailure

function saleCommandFromCart(cart: Cart) {
  return prepareSale({
    id: cart.id,
    storeId: cart.storeId,
    lines: cart.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPricePesewas: line.unitPricePesewas,
    })),
  })
}

export async function checkoutCart(
  cart: Cart,
  client: CommitSaleClient,
  role: Role,
): Promise<CheckoutResult> {
  const snapshot = cloneCart(cart)
  try {
    const result: CommitSaleResult = await commitSale(client, saleCommandFromCart(snapshot), role)
    return {
      ok: true,
      saleId: result.saleId,
      replayed: result.replayed,
      skipDuplicateSuccessEffects: result.replayed,
    }
  } catch (error) {
    const mapped = mapCommitSaleFailure(error, { lineLabelByVariantId: cartLineLabels(snapshot) })
    let nextCart = snapshot
    if (mapped.regenerateLineIds) {
      nextCart = regenerateCartLineIds(snapshot)
    }
    return { ok: false, userMessage: mapped.userMessage, cart: nextCart }
  }
}
