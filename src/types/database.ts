import type { DbInteger, Pesewas } from '../lib/money.ts'

/**
 * Declared Supabase schema for this frontend. Regenerate from the backend
 * project when its migrations land. `commit_sale` is a backend follow-up:
 * see docs/commit-sale.md.
 */
export type CommitSaleLineRecord = {
  id: string
  variant_id: string
  quantity: DbInteger
  unit_price_pesewas: Pesewas
}

export type CommitSaleRpcResult = {
  sale_id: string
  replayed: boolean
}

type TableDef<Row extends Record<string, unknown>> = {
  Row: Row
  Insert: Row
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      sales: TableDef<{
        id: string
        store_id: string
        total_pesewas: Pesewas
      }>
      sale_lines: TableDef<{
        id: string
        sale_id: string
        variant_id: string
        quantity: DbInteger
        unit_price_pesewas: Pesewas
      }>
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_sale: {
        Args: {
          p_idempotency_key: string
          p_store_id: string
          p_lines: CommitSaleLineRecord[]
        }
        Returns: CommitSaleRpcResult
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
