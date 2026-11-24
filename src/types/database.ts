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

export type CommitSaleStatus = 'completed' | 'voided'

export type CommitSaleRpcResult = {
  sale_id: string
  replayed: boolean
  status?: CommitSaleStatus | string
  total_pesewas?: Pesewas
}

export type ProductCategoryDb =
  | 'shirts'
  | 'dresses'
  | 'kaftans'
  | 'jeans'
  | 'shoes'
  | 'accessories'

type TableDef<Row extends Record<string, unknown>> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      products: TableDef<{
        id: string
        name: string
        category: ProductCategoryDb
        description: string | null
        image_path: string | null
        active: boolean
        created_at: string
        updated_at: string
      }>
      product_variants: TableDef<{
        id: string
        product_id: string
        sku: string
        size_name: string
        colour_name: string
        price_pesewas: Pesewas
        stock_qty: number
        low_stock_threshold: number
        created_at: string
        updated_at: string
      }>
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