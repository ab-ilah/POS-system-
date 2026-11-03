export type UpsertRow = { id: string } & Record<string, string | number | boolean | null>

export interface RowStore {
  upsert(table: string, rows: readonly UpsertRow[], onConflict: 'id'): Promise<void>
}

export interface AuthGateway {
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ error: { message: string } | null }>
}

export type QueryClientLike = {
  from(table: string): {
    upsert(
      values: readonly UpsertRow[],
      options: { onConflict: 'id' },
    ): Promise<{ error: { message: string } | null }>
  }
}
