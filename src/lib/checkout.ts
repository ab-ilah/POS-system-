import { mapCommitSaleFailure, type CommitSaleFailureCode } from './commit-sale-errors.ts'
import {
  cartLineLabels,
  cloneCart,
  regenerateCartLineIds,
  regenerateCartSaleId,
  type Cart,
} from './cart.ts'
import { commitSale, prepareSale, type CommitSaleClient, type CommitSaleResult } from './data/sales.ts'
import type { Pesewas } from './money.ts'
import type { Role } from '../types/index.ts'

const IDEMPOTENCY_KEY_REUSE =
  'An earlier sale from this cart was already recorded with different items. Check the last receipt before taking payment again.'

export const CHECKOUT_UNCONFIRMED_MESSAGE =
  "We couldn't confirm this sale. Check Sales before taking payment again."

export type CheckoutSuccess = {
  ok: true
  saleId: string
  replayed: boolean
  status: 'completed' | 'voided'
  totalPesewas: Pesewas
}

export type CheckoutUnconfirmed = {
  ok: false
  kind: 'unconfirmed'
  userMessage: string
  cart: Cart
}

export type CheckoutFailure = {
  ok: false
  kind: 'error'
  userMessage: string
  cart: Cart
  code: CommitSaleFailureCode
  /** True when the mapped failure is P0004 idempotency_key_reuse (cart stays on the same key). */
  idempotencyReuse: boolean
}

export type CheckoutResult = CheckoutSuccess | CheckoutUnconfirmed | CheckoutFailure

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
  if (mapped.code === 'P0004' && mapped.userMessage === IDEMPOTENCY_KEY_REUSE) {
    return cart
  }
  let nextCart = cart
  if (mapped.assignNewSaleId) {
    nextCart = regenerateCartSaleId(nextCart)
  }
  if (mapped.regenerateLineIds) {
    nextCart = regenerateCartLineIds(nextCart)
  }
  return nextCart
}

function successFromResult(result: CommitSaleResult, cart: Cart): CheckoutResult {
  if (result.status === 'unknown' || result.totalPesewas == null) {
    return {
      ok: false,
      kind: 'unconfirmed',
      userMessage: CHECKOUT_UNCONFIRMED_MESSAGE,
      cart,
    }
  }
  return {
    ok: true,
    saleId: result.saleId,
    replayed: result.replayed,
    status: result.status,
    totalPesewas: result.totalPesewas,
  }
}

export async function checkoutCart(
  cart: Cart,
  client: CommitSaleClient,
  role: Role,
): Promise<CheckoutResult> {
  const snapshot = cloneCart(cart)
  try {
    const result: CommitSaleResult = await commitSale(client, saleCommandFromCart(snapshot), role)
    return successFromResult(result, snapshot)
  } catch (error) {
    const mapped = mapCommitSaleFailure(error, { lineLabelByVariantId: cartLineLabels(snapshot) })
    const isReuse = mapped.code === 'P0004' && mapped.userMessage === IDEMPOTENCY_KEY_REUSE
    return {
      ok: false,
      kind: 'error',
      userMessage: mapped.userMessage,
      cart: cartAfterFailure(snapshot, mapped),
      code: mapped.code,
      idempotencyReuse: isReuse,
    }
  }
}