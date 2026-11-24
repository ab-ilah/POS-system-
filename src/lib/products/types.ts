import type { Pesewas } from '@/lib/money.ts'

export const PRODUCT_CATEGORIES = [
  'shirts',
  'dresses',
  'kaftans',
  'jeans',
  'shoes',
  'accessories',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export function categoryLabel(category: ProductCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export type ProductRow = {
  id: string
  name: string
  category: ProductCategory
  description: string | null
  image_path: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type ProductVariantRow = {
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
}

export type ProductWithVariants = ProductRow & {
  variants: ProductVariantRow[]
}

export type ProductListFilters = {
  search: string
  category: ProductCategory | 'all'
  includeArchived: boolean
}

export type ProductInput = {
  name: string
  category: ProductCategory
  description: string
}

export type VariantInput = {
  sku: string
  size_name: string
  colour_name: string
  price_pesewas: Pesewas
  low_stock_threshold: number
}

export function isLowStock(variant: Pick<ProductVariantRow, 'stock_qty' | 'low_stock_threshold'>): boolean {
  return variant.stock_qty <= variant.low_stock_threshold
}

export function formatVariantLabel(variant: Pick<ProductVariantRow, 'size_name' | 'colour_name'>): string {
  return `${variant.size_name} · ${variant.colour_name}`
}