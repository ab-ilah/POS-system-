import type { QueryClientLike, RowStore } from './types.ts'

export function createRowStore(client: QueryClientLike): RowStore {
  return {
    async upsert(table, rows, onConflict) {
      const { error } = await client.from(table).upsert(rows, { onConflict })
      if (error) throw new Error(error.message)
    },
  }
}
