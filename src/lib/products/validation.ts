import { PRODUCT_CATEGORIES, type ProductCategory, type ProductInput, type VariantInput } from '@/lib/products/types.ts'
import { pesewas } from '@/lib/money.ts'
import type { Pesewas } from '@/lib/money.ts'

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value)
}

export type FieldErrors = Record<string, string>

export function validateProductInput(input: ProductInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.name.trim()) errors.name = 'Name is required.'
  if (!isProductCategory(input.category)) errors.category = 'Pick a category.'
  return errors
}

export function validateVariantInput(input: VariantInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.sku.trim()) errors.sku = 'SKU is required.'
  if (!input.size_name.trim()) errors.size_name = 'Size is required.'
  if (!input.colour_name.trim()) errors.colour_name = 'Colour is required.'
  if (input.price_pesewas < 0) errors.price_pesewas = 'Price must be zero or higher.'
  if (input.low_stock_threshold < 0) errors.low_stock_threshold = 'Threshold must be zero or higher.'
  return errors
}

export function pesewasFromCediInput(cedis: string, pesewaPart = '0'): Pesewas | null {
  const whole = cedis.trim()
  if (!whole && !pesewaPart.trim()) return null
  const major = Number.parseInt(whole || '0', 10)
  const minor = Number.parseInt(pesewaPart.padEnd(2, '0').slice(0, 2), 10)
  if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 0 || minor < 0) return null
  return pesewas(major * 100 + minor)
}