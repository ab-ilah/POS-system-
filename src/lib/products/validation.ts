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
  if (!Number.isInteger(input.low_stock_threshold) || input.low_stock_threshold < 0) {
    errors.low_stock_threshold = 'Threshold must be a whole number of zero or higher.'
  }
  return errors
}

/** Parse GH₵ major/minor fields or a single decimal string like `12.50`. */
export function pesewasFromCediInput(cedis: string, pesewaPart = '0'): Pesewas | null {
  const majorRaw = cedis.trim()
  const minorRaw = pesewaPart.trim()
  if (!majorRaw && !minorRaw) return null

  if (majorRaw.includes('.')) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(majorRaw)
    if (!match) return null
    if (match[2] != null && match[2].length > 2) return null
    const major = Number.parseInt(match[1] ?? '0', 10)
    const minor = Number.parseInt((match[2] ?? '0').padEnd(2, '0').slice(0, 2), 10)
    if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 0 || minor < 0 || minor > 99) return null
    return pesewas(major * 100 + minor)
  }

  const major = Number.parseInt(majorRaw || '0', 10)
  const minor = Number.parseInt(minorRaw.padEnd(2, '0').slice(0, 2) || '0', 10)
  if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 0 || minor < 0 || minor > 99) return null
  return pesewas(major * 100 + minor)
}