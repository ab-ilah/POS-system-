import { browserSupabase, isSupabaseConfigured } from '@/lib/data/supabase.ts'
import { pesewas, type Pesewas } from '@/lib/money.ts'
import type { ProductInput, ProductVariantRow, ProductWithVariants, VariantInput } from '@/lib/products/types.ts'
import type { ProductCategoryDb } from '@/types/database.ts'

export const PRODUCTS_QUERY_KEY = ['products'] as const

export const PRODUCT_VARIANT_UPDATE_COLUMNS = [
  'product_id',
  'sku',
  'size_name',
  'colour_name',
  'price_pesewas',
  'low_stock_threshold',
] as const

export type ProductVariantUpdatePayload = {
  product_id: string
  sku: string
  size_name: string
  colour_name: string
  price_pesewas: Pesewas
  low_stock_threshold: number
}

const CATALOG_UNAVAILABLE =
  'The catalogue could not be loaded. Sign in with a connection to the shop database and try again.'

import { normalizeSku } from '@/lib/products/sku.ts'

export function buildProductVariantUpdatePayload(
  productId: string,
  input: VariantInput,
): ProductVariantUpdatePayload {
  return {
    product_id: productId,
    sku: normalizeSku(input.sku),
    size_name: input.size_name.trim(),
    colour_name: input.colour_name.trim(),
    price_pesewas: input.price_pesewas,
    low_stock_threshold: input.low_stock_threshold,
  }
}

async function withDemoCatalog<T>(
  run: (demo: typeof import('./demo-product-store.ts')) => T | Promise<T>,
): Promise<T> {
  if (!__POS_DEV_E2E_ASSIST__) {
    throw new Error(CATALOG_UNAVAILABLE)
  }
  const demo = await import('./demo-product-store.ts')
  return run(demo)
}

function requireSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(CATALOG_UNAVAILABLE)
  }
  const client = browserSupabase()
  if (!client) {
    throw new Error(CATALOG_UNAVAILABLE)
  }
  return client
}

function rowToProduct(row: Record<string, unknown>, variants: ProductVariantRow[]): ProductWithVariants {
  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category as ProductWithVariants['category'],
    description: row.description != null ? String(row.description) : null,
    image_path: row.image_path != null ? String(row.image_path) : null,
    active: Boolean(row.active),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    variants,
  }
}

function mapVariant(row: Record<string, unknown>): ProductVariantRow {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    sku: String(row.sku),
    size_name: String(row.size_name),
    colour_name: String(row.colour_name),
    price_pesewas: pesewas(Number(row.price_pesewas)),
    stock_qty: Number(row.stock_qty),
    low_stock_threshold: Number(row.low_stock_threshold ?? 5),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export async function fetchProductList(filters: {
  search: string
  category: string
  includeArchived: boolean
}): Promise<ProductWithVariants[]> {
  if (__POS_DEV_E2E_ASSIST__) {
    return withDemoCatalog((demo) => demo.demoListProducts(filters))
  }

  const client = requireSupabaseClient()

  let query = client
    .from('products')
    .select('*, product_variants(*)')
    .order('name')

  if (!filters.includeArchived) {
    query = query.eq('active', true)
  }
  if (filters.category !== 'all') {
    query = query.eq('category', filters.category as ProductCategoryDb)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const needle = filters.search.trim().toLowerCase()
  const mapped = (data ?? []).map((row) => {
    const variantRows = Array.isArray(row.product_variants) ? row.product_variants : []
    return rowToProduct(row, variantRows.map((variant) => mapVariant(variant as Record<string, unknown>)))
  })

  return mapped.filter((product) => {
    if (!needle) return true
    if (product.name.toLowerCase().includes(needle)) return true
    return product.variants.some((variant) => variant.sku.toLowerCase().includes(needle))
  })
}

export async function fetchProductById(productId: string): Promise<ProductWithVariants | null> {
  if (__POS_DEV_E2E_ASSIST__) {
    return withDemoCatalog((demo) => demo.demoGetProduct(productId))
  }

  const client = requireSupabaseClient()

  const { data, error } = await client
    .from('products')
    .select('*, product_variants(*)')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const variantRows = Array.isArray(data.product_variants) ? data.product_variants : []
  return rowToProduct(data, variantRows.map((variant) => mapVariant(variant as Record<string, unknown>)))
}

export async function createProduct(input: ProductInput): Promise<ProductWithVariants> {
  if (__POS_DEV_E2E_ASSIST__) {
    return withDemoCatalog((demo) => demo.demoCreateProduct(input))
  }

  const client = requireSupabaseClient()

  const { data, error } = await client
    .from('products')
    .insert({
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim() || null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToProduct(data, [])
}

export async function updateProduct(productId: string, input: ProductInput): Promise<ProductWithVariants> {
  if (__POS_DEV_E2E_ASSIST__) {
    return withDemoCatalog((demo) => demo.demoUpdateProduct(productId, input))
  }

  const client = requireSupabaseClient()

  const { data, error } = await client
    .from('products')
    .update({
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim() || null,
    })
    .eq('id', productId)
    .select('*, product_variants(*)')
    .single()
  if (error) throw new Error(error.message)
  const variantRows = Array.isArray(data.product_variants) ? data.product_variants : []
  return rowToProduct(data, variantRows.map((variant) => mapVariant(variant as Record<string, unknown>)))
}

export async function setProductActive(productId: string, active: boolean): Promise<ProductWithVariants> {
  if (__POS_DEV_E2E_ASSIST__) {
    return withDemoCatalog((demo) => demo.demoSetProductActive(productId, active))
  }

  const client = requireSupabaseClient()

  const { data, error } = await client
    .from('products')
    .update({ active })
    .eq('id', productId)
    .select('*, product_variants(*)')
    .single()
  if (error) throw new Error(error.message)
  const variantRows = Array.isArray(data.product_variants) ? data.product_variants : []
  return rowToProduct(data, variantRows.map((variant) => mapVariant(variant as Record<string, unknown>)))
}

export function friendlyProductError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code)
    if (code === '23505') {
      return 'That SKU is already in use. Pick another one.'
    }
    if (code === '42501') {
      return 'You do not have permission to change this variant. Ask a manager.'
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('23505') || message.toLowerCase().includes('duplicate')) {
    return 'That SKU is already in use. Pick another one.'
  }
  if (message.includes('42501')) {
    return 'You do not have permission to change this variant. Ask a manager.'
  }
  return message || 'Something went wrong. Please try again.'
}

export async function upsertProductVariant(
  productId: string,
  variantId: string | null,
  input: VariantInput,
): Promise<ProductVariantRow> {
  try {
    if (__POS_DEV_E2E_ASSIST__) {
      return withDemoCatalog((demo) => demo.demoUpsertVariant(productId, variantId, input))
    }

    const client = requireSupabaseClient()
    const updatePayload = buildProductVariantUpdatePayload(productId, input)

    if (variantId) {
      const { data, error } = await client
        .from('product_variants')
        .update(updatePayload)
        .eq('id', variantId)
        .select('*')
        .single()
      if (error) throw error
      return mapVariant(data)
    }

    const { data, error } = await client.from('product_variants').insert(updatePayload).select('*').single()
    if (error) throw error
    return mapVariant(data)
  } catch (error) {
    throw Object.assign(new Error(friendlyProductError(error)), { cause: error })
  }
}