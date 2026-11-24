import { mapCommitSaleFailure, variantIdFromCommitSaleDetails, type CommitSaleFailureCode } from './commit-sale-errors.ts'
import { isCommitSaleRpcError } from './data/commit-sale-rpc-error.ts'
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
  /** Set when the server rejected a stale shelf price (P0003). */
  priceChangeVariantIds?: readonly string[]
}

export type CheckoutResult = CheckoutSuccess | CheckoutUnconfirmed | CheckoutFailure

function isIdempotencyKeyReuse(error: unknown): boolean {
  if (!isCommitSaleRpcError(error)) return false
  if (error.code.trim().toUpperCase() !== 'P0004') return false
  const message = error.message.trim().toLowerCase()
  return message === 'idempotency_key_reuse' || message === 'idempotency_key_conflict'
}

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
  if (mapped.code === 'P0004') return cart
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
    const isReuse = isIdempotencyKeyReuse(error)
    const priceChangeVariantIds =
      mapped.code === 'P0003' && isCommitSaleRpcError(error)
        ? (() => {
            const variantId = variantIdFromCommitSaleDetails(error.details)
            return variantId ? [variantId] : cart.lines.map((line) => line.variantId)
          })()
        : undefined
    return {
      ok: false,
      kind: 'error',
      userMessage: mapped.userMessage,
      cart: cartAfterFailure(snapshot, mapped),
      code: mapped.code,
      idempotencyReuse: isReuse,
      priceChangeVariantIds,
    }
  }
}