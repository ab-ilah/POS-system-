import { CommitSaleTimeoutError } from './data/commit-sale-call.ts'
import { CommitSaleRpcError, isCommitSaleRpcError } from './data/commit-sale-rpc-error.ts'
import { EMPTY_ERROR_FALLBACK } from './user-message.ts'

export type CommitSaleFailureCode = 'P0004' | 'P0005' | 'PSTCK' | 'P0002' | 'generic'

export type MappedCommitSaleFailure = {
  code: CommitSaleFailureCode
  userMessage: string
  /** When true, the caller should assign new line ids before the cashier retries. */
  regenerateLineIds: boolean
}

const REPLAY_MISMATCH =
  'This sale conflicts with an earlier one. Refresh the till and try again.'
const DUPLICATE_LINE_ID =
  'A cart line clashed with the server. New line ids were assigned — try again.'
const UNKNOWN_ITEM =
  'That item is no longer on the catalogue. Remove it from the cart and try again.'

function normaliseSqlState(code: string): string {
  return code.trim().toUpperCase()
}

function itemNameFromRpcError(error: CommitSaleRpcError): string | null {
  if (error.hint) return error.hint
  if (!error.details) return null
  const named = error.details.match(/^(?:item|variant|product)(?:_name)?\s*[=:]\s*(.+)$/i)
  if (named?.[1]) return named[1].trim()
  return error.details
}

function insufficientStockMessage(error: CommitSaleRpcError, fallbackLabel?: string): string {
  const named = itemNameFromRpcError(error) ?? fallbackLabel
  if (named) return `Not enough stock left for ${named}. Reduce the quantity or remove the line.`
  return 'Not enough stock left for an item in the cart. Reduce quantities or remove a line.'
}

export function mapCommitSaleFailure(
  error: unknown,
  context?: { lineLabelByVariantId?: ReadonlyMap<string, string> },
): MappedCommitSaleFailure {
  if (error instanceof CommitSaleTimeoutError) {
    return { code: 'generic', userMessage: EMPTY_ERROR_FALLBACK, regenerateLineIds: false }
  }

  if (!isCommitSaleRpcError(error)) {
    return { code: 'generic', userMessage: EMPTY_ERROR_FALLBACK, regenerateLineIds: false }
  }

  const sqlState = normaliseSqlState(error.code)

  if (sqlState === 'P0004') {
    return { code: 'P0004', userMessage: REPLAY_MISMATCH, regenerateLineIds: false }
  }

  if (sqlState === 'P0005') {
    return { code: 'P0005', userMessage: DUPLICATE_LINE_ID, regenerateLineIds: true }
  }

  if (sqlState === 'P0002') {
    return { code: 'P0002', userMessage: UNKNOWN_ITEM, regenerateLineIds: false }
  }

  if (sqlState === 'PSTCK') {
    let fallbackLabel: string | undefined
    const variantMatch = error.details?.match(/variant_id\s*[=:]\s*([0-9a-f-]{36})/i)
    const variantId = variantMatch?.[1]
    if (variantId && context?.lineLabelByVariantId) {
      fallbackLabel = context.lineLabelByVariantId.get(variantId)
    }
    return {
      code: 'PSTCK',
      userMessage: insufficientStockMessage(error, fallbackLabel),
      regenerateLineIds: false,
    }
  }

  return { code: 'generic', userMessage: EMPTY_ERROR_FALLBACK, regenerateLineIds: false }
}
