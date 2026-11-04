import type { DbInteger } from '../money.ts'

export type UpsertValue = string | boolean | null | DbInteger
export type UpsertRow = { id: string } & Record<string, UpsertValue>

export interface RowStore {
  upsert(table: string, rows: readonly UpsertRow[], onConflict: 'id'): Promise<void>
}

export interface AuthGateway {
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ error: { message: string; status?: number } | null }>
}

export type QueryClientLike = {
  from(table: string): {
    upsert(
      values: readonly UpsertRow[],
      options: { onConflict: 'id' },
    ): Promise<{ error: { message: string } | null }>
  }
}
