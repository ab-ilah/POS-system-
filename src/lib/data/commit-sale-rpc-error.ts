/** Fields surfaced by PostgREST / Supabase on an RPC failure. */
export type CommitSaleRpcErrorFields = {
  code?: string | null
  message: string
  details?: string | null
  hint?: string | null
}

export class CommitSaleRpcError extends Error {
  readonly code: string
  readonly details: string
  readonly hint: string

  constructor(fields: CommitSaleRpcErrorFields) {
    super(fields.message)
    this.name = 'CommitSaleRpcError'
    this.code = fields.code?.trim() ?? ''
    this.details = fields.details?.trim() ?? ''
    this.hint = fields.hint?.trim() ?? ''
  }
}

export function isCommitSaleRpcError(error: unknown): error is CommitSaleRpcError {
  return error instanceof CommitSaleRpcError
}
