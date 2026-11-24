import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import {
  createProduct,
  fetchProductById,
  friendlyProductError,
  PRODUCTS_QUERY_KEY,
  updateProduct,
  upsertProductVariant,
} from '@/lib/data/products.ts'
import { pesewasFromCediInput, validateProductInput, validateVariantInput } from '@/lib/products/validation.ts'
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductVariantRow,
  type VariantInput,
} from '@/lib/products/types.ts'
import { categoryLabel, formatVariantLabel } from '@/lib/products/types.ts'
import { formatGhs, pesewas } from '@/lib/money.ts'

const emptyVariant: VariantInput = {
  sku: '',
  size_name: '',
  colour_name: '',
  price_pesewas: pesewas(0),
  low_stock_threshold: 5,
}

export function ProductFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  const { productId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const existing = useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'detail', productId],
    queryFn: () => fetchProductById(productId),
    enabled: mode === 'edit' && productId.length > 0,
  })

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ProductCategory>('shirts')
  const [description, setDescription] = useState('')
  const [productErrors, setProductErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const [variantDraft, setVariantDraft] = useState(emptyVariant)
  const [priceMajor, setPriceMajor] = useState('0')
  const [priceMinor, setPriceMinor] = useState('00')
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({})
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantMessage, setVariantMessage] = useState<string | null>(null)

  const productInput = useMemo(
    () => ({
      name,
      category,
      description,
    }),
    [category, description, name],
  )

  useEffect(() => {
    if (mode !== 'edit' || !existing.data) return
    setName(existing.data.name)
    setCategory(existing.data.category)
    setDescription(existing.data.description ?? '')
  }, [existing.data, mode])

  const saveProduct = useMutation({
    mutationFn: async () => {
      const fieldErrors = validateProductInput(productInput)
      setProductErrors(fieldErrors)
      if (Object.keys(fieldErrors).length > 0) throw new Error('Fix the highlighted fields.')
      if (mode === 'create') return createProduct(productInput)
      return updateProduct(productId, productInput)
    },
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
      navigate(`/products/${product.id}`)
    },
    onError: (error) => setFormError(friendlyProductError(error)),
  })

  const saveVariant = useMutation({
    mutationFn: async (targetProductId: string) => {
      const price = pesewasFromCediInput(priceMajor, priceMinor)
      if (price == null) throw new Error('Enter a valid price.')
      const input: VariantInput = { ...variantDraft, price_pesewas: price }
      const fieldErrors = validateVariantInput(input)
      setVariantErrors(fieldErrors)
      if (Object.keys(fieldErrors).length > 0) throw new Error('Fix the variant fields.')
      return upsertProductVariant(targetProductId, editingVariantId, input)
    },
    onSuccess: async () => {
      setVariantDraft(emptyVariant)
      setPriceMajor('0')
      setPriceMinor('00')
      setEditingVariantId(null)
      setVariantMessage('Variant saved.')
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
    },
    onError: (error) => setVariantMessage(friendlyProductError(error)),
  })

  const onSubmitProduct = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    saveProduct.mutate()
  }

  const startEditVariant = (variant: ProductVariantRow) => {
    setEditingVariantId(variant.id)
    setVariantDraft({
      sku: variant.sku,
      size_name: variant.size_name,
      colour_name: variant.colour_name,
      price_pesewas: variant.price_pesewas,
      low_stock_threshold: variant.low_stock_threshold,
    })
    setPriceMajor(String(Math.floor(variant.price_pesewas / 100)))
    setPriceMinor(String(variant.price_pesewas % 100).padStart(2, '0'))
  }

  const title = mode === 'create' ? 'Add product' : 'Edit product'

  if (mode === 'edit' && existing.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link to="/products" className="underline-offset-2 hover:underline">
            Products
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>

      <form className="space-y-4" onSubmit={onSubmitProduct} noValidate>
        <div className="space-y-1">
          <Label htmlFor="product-name">Name</Label>
          <Input id="product-name" className="min-h-11" value={name} onChange={(event) => setName(event.target.value)} required />
          {productErrors.name ? <p className="text-sm text-destructive">{productErrors.name}</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-category-edit">Category</Label>
          <select
            id="product-category-edit"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as ProductCategory)}
          >
            {PRODUCT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-description">Description</Label>
          <textarea
            id="product-description"
            className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        <Button type="submit" className="min-h-11" disabled={saveProduct.isPending}>
          {mode === 'create' ? 'Create product' : 'Save product'}
        </Button>
      </form>

      {mode === 'edit' && existing.data ? (
        <section className="space-y-4 border-t border-border pt-6" aria-labelledby="variant-form-heading">
          <h2 id="variant-form-heading" className="text-lg font-semibold">
            Variants
          </h2>
          <ul className="space-y-2 text-sm">
            {existing.data.variants.map((variant) => (
              <li key={variant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span>
                  {formatVariantLabel(variant)} · {variant.sku} · {formatGhs(variant.price_pesewas)}
                </span>
                <Button type="button" variant="outline" className="min-h-9" onClick={() => startEditVariant(variant)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>

          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setVariantMessage(null)
              saveVariant.mutate(productId)
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="variant-sku">SKU</Label>
              <Input id="variant-sku" className="min-h-11" value={variantDraft.sku} onChange={(event) => setVariantDraft((prev) => ({ ...prev, sku: event.target.value }))} />
              {variantErrors.sku ? <p className="text-sm text-destructive">{variantErrors.sku}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="variant-size">Size</Label>
              <Input id="variant-size" className="min-h-11" value={variantDraft.size_name} onChange={(event) => setVariantDraft((prev) => ({ ...prev, size_name: event.target.value }))} />
              {variantErrors.size_name ? <p className="text-sm text-destructive">{variantErrors.size_name}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="variant-colour">Colour</Label>
              <Input id="variant-colour" className="min-h-11" value={variantDraft.colour_name} onChange={(event) => setVariantDraft((prev) => ({ ...prev, colour_name: event.target.value }))} />
              {variantErrors.colour_name ? <p className="text-sm text-destructive">{variantErrors.colour_name}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="variant-threshold">Low-stock threshold</Label>
              <Input
                id="variant-threshold"
                type="number"
                min={0}
                className="min-h-11"
                value={variantDraft.low_stock_threshold}
                onChange={(event) =>
                  setVariantDraft((prev) => ({ ...prev, low_stock_threshold: Number(event.target.value) }))
                }
              />
              {variantErrors.low_stock_threshold ? (
                <p className="text-sm text-destructive">{variantErrors.low_stock_threshold}</p>
              ) : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Price (GH₵)</Label>
              <div className="flex gap-2">
                <Input
                  aria-label="Price cedis"
                  className="min-h-11"
                  inputMode="numeric"
                  value={priceMajor}
                  onChange={(event) => setPriceMajor(event.target.value)}
                />
                <Input
                  aria-label="Price pesewas"
                  className="min-h-11 w-20"
                  inputMode="numeric"
                  value={priceMinor}
                  onChange={(event) => setPriceMinor(event.target.value)}
                />
              </div>
            </div>
            {variantMessage ? <p className="text-sm text-muted-foreground sm:col-span-2">{variantMessage}</p> : null}
            <Button type="submit" className="min-h-11 sm:col-span-2" disabled={saveVariant.isPending}>
              {editingVariantId ? 'Save variant' : 'Add variant'}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  )
}