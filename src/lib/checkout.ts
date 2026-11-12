import { mapCommitSaleFailure } from './commit-sale-errors.ts'
import {
  cartLineLabels,
  cloneCart,
  regenerateCartLineIds,
  regenerateCartSaleId,
  type Cart,
} from './cart.ts'
import { commitSale, prepareSale, type CommitSaleClient, type CommitSaleResult } from './data/sales.ts'
import type { Role } from '../types/index.ts'

export type CheckoutSuccess = {
  ok: true
  saleId: string
  replayed: boolean
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

function cartAfterFailure(cart: Cart, mapped: ReturnType<typeof mapCommitSaleFailure>): Cart {
  let nextCart = cart
  if (mapped.assignNewSaleId) {
    nextCart = regenerateCartSaleId(nextCart)
  }
  if (mapped.regenerateLineIds) {
    nextCart = regenerateCartLineIds(nextCart)
  }
  return nextCart
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
    }
  } catch (error) {
    const mapped = mapCommitSaleFailure(error, { lineLabelByVariantId: cartLineLabels(snapshot) })
    return { ok: false, userMessage: mapped.userMessage, cart: cartAfterFailure(snapshot, mapped) }
  }
}
