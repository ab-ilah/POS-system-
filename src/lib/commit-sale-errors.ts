import { CommitSaleTimeoutError } from './data/commit-sale-call.ts'
import { CommitSaleRpcError, isCommitSaleRpcError } from './data/commit-sale-rpc-error.ts'
import { EMPTY_ERROR_FALLBACK } from './user-message.ts'

export type CommitSaleFailureCode = 'P0004' | 'P0005' | 'PSTCK' | 'P0002' | 'generic'

export type MappedCommitSaleFailure = {
  code: CommitSaleFailureCode
  userMessage: string
  /** When true, the caller should assign new line ids before the cashier retries. */
  regenerateLineIds: boolean
  /** When true, the caller should assign a new sale idempotency key and keep the lines. */
  assignNewSaleId: boolean
}

const REPLAY_MISMATCH =
  'This sale conflicts with an earlier one. Refresh the till and try again.'
const IDEMPOTENCY_KEY_CONFLICT =
  'An earlier sale from this cart was already recorded with different items. Check the last receipt before taking payment again.'
const INVALID_SALE_LINE =
  'Something in the cart could not be sent. Check the items and try again.'
const EMPTY_SALE = 'Add at least one item before taking payment.'
const DUPLICATE_LINE_RETRY =
  'The till could not save this cart. Tap Pay again.'
const UNKNOWN_ITEM =
  'That item is no longer on the catalogue. Remove it from the cart and try again.'
const UNKNOWN_STORE =
  'This shop is not recognised. Sign out and sign in again, or ask a manager.'

function normaliseSqlState(code: string): string {
  return code.trim().toUpperCase()
}

function normaliseMessage(message: string): string {
  return message.trim().toLowerCase()
}

function variantIdFromDetails(details: string | undefined): string | null {
  if (!details) return null
  const match = details.match(/variant_id\s*[=:]\s*(\S+)/i)
  return match?.[1] ?? null
}

function stockItemLabel(
  error: CommitSaleRpcError,
  context?: { lineLabelByVariantId?: ReadonlyMap<string, string> },
): string | null {
  if (error.hint) return error.hint
  const variantId = variantIdFromDetails(error.details)
  if (variantId && context?.lineLabelByVariantId) {
    return context.lineLabelByVariantId.get(variantId) ?? null
  }
  return null
}

function insufficientStockMessage(
  error: CommitSaleRpcError,
  context?: { lineLabelByVariantId?: ReadonlyMap<string, string> },
): string {
  const named = stockItemLabel(error, context)
  if (named) return `Not enough stock left for ${named}. Reduce the quantity or remove the line.`
  return 'Not enough stock left for an item in the cart. Reduce quantities or remove a line.'
}

function idempotencyKeyConflictFailure(): MappedCommitSaleFailure {
  return {
    code: 'P0004',
    userMessage: IDEMPOTENCY_KEY_CONFLICT,
    regenerateLineIds: true,
    assignNewSaleId: true,
  }
}

function mapP0004(error: CommitSaleRpcError): MappedCommitSaleFailure {
  const message = normaliseMessage(error.message)
  // Backend: supabase/migrations/20261112180000_pos_auth_hardening.sql (idempotency_key_conflict)
  if (message === 'idempotency_key_conflict') {
    return idempotencyKeyConflictFailure()
  }
  // Backend: same migration (invalid sale line, empty sale, and other P0004 cases)
  if (message === 'invalid sale line') {
    return {
      code: 'P0004',
      userMessage: INVALID_SALE_LINE,
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }
  if (message === 'a sale needs at least one line') {
    return {
      code: 'P0004',
      userMessage: EMPTY_SALE,
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }
  return {
    code: 'P0004',
    userMessage: REPLAY_MISMATCH,
    regenerateLineIds: false,
    assignNewSaleId: false,
  }
}

function mapP0002(error: CommitSaleRpcError): MappedCommitSaleFailure {
  const message = normaliseMessage(error.message)
  // Backend: supabase/migrations/20261111120000_commit_sale_hardening.sql (no such store, no such variant)
  if (message === 'no such store') {
    return {
      code: 'P0002',
      userMessage: UNKNOWN_STORE,
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }
  return {
    code: 'P0002',
    userMessage: UNKNOWN_ITEM,
    regenerateLineIds: false,
    assignNewSaleId: false,
  }
}

export function mapCommitSaleFailure(
  error: unknown,
  context?: { lineLabelByVariantId?: ReadonlyMap<string, string> },
): MappedCommitSaleFailure {
  if (error instanceof CommitSaleTimeoutError) {
    return {
      code: 'generic',
      userMessage: EMPTY_ERROR_FALLBACK,
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }

  if (!isCommitSaleRpcError(error)) {
    return {
      code: 'generic',
      userMessage: EMPTY_ERROR_FALLBACK,
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }

  const sqlState = normaliseSqlState(error.code)

  if (sqlState === 'P0004') {
    return mapP0004(error)
  }

  if (sqlState === 'P0005') {
    return {
      code: 'P0005',
      userMessage: DUPLICATE_LINE_RETRY,
      regenerateLineIds: true,
      assignNewSaleId: false,
    }
  }

  if (sqlState === 'P0002') {
    return mapP0002(error)
  }

  if (sqlState === 'PSTCK') {
    return {
      code: 'PSTCK',
      userMessage: insufficientStockMessage(error, context),
      regenerateLineIds: false,
      assignNewSaleId: false,
    }
  }

  return {
    code: 'generic',
    userMessage: EMPTY_ERROR_FALLBACK,
    regenerateLineIds: false,
    assignNewSaleId: false,
  }
}
