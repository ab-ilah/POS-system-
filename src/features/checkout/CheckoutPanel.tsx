import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import {
  browserCheckoutCart,
  cloneCart,
  type Cart,
  type CheckoutResult,
} from '@/lib/data/index.ts'
import { formatGhs, lineTotal, shelfPriceFromCedis, sumPesewas } from '@/lib/money.ts'

const starterCart = (): Cart => ({
  id: crypto.randomUUID(),
  storeId: '00000000-0000-4000-8000-000000000001',
  lines: [
    {
      id: crypto.randomUUID(),
      variantId: '00000000-0000-4000-8000-000000000101',
      quantity: 1,
      unitPricePesewas: shelfPriceFromCedis(189, 0),
      label: 'Oxford shirt — navy · M',
    },
  ],
})

function successHeadline(result: CheckoutResult & { ok: true }): string {
  return result.skipDuplicateSuccessEffects ? 'Sale already recorded' : 'Sale complete'
}

export function CheckoutPanel() {
  const [cart, setCart] = useState<Cart>(() => starterCart())
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [checkoutTone, setCheckoutTone] = useState<'error' | 'success' | null>(null)

  const mutation = useMutation({
    mutationFn: () => browserCheckoutCart(cart),
    onSuccess: (result) => {
      if (result.ok) {
        setCheckoutTone('success')
        setCheckoutMessage(successHeadline(result))
        setCart(starterCart())
        return
      }
      setCheckoutTone('error')
      setCheckoutMessage(result.userMessage)
      setCart(result.cart)
    },
    onError: () => {
      setCheckoutTone('error')
      setCheckoutMessage('Something went wrong. Please try again.')
    },
  })

  const total = sumPesewas(cart.lines.map((line) => lineTotal(line.unitPricePesewas, line.quantity)))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cart checkout</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pay sends this cart through <code className="text-xs">commit_sale</code>. Failures keep the cart unless the
          server asks for new line ids.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-4">
              <span>
                {line.label} × {line.quantity}
              </span>
              <span className="font-medium">{formatGhs(lineTotal(line.unitPricePesewas, line.quantity))}</span>
            </li>
          ))}
        </ul>
        <p className="text-base font-semibold">Total {formatGhs(total)}</p>
        {checkoutMessage ? (
          <p
            role="alert"
            className={
              checkoutTone === 'success' ? 'text-sm text-emerald-800' : 'text-sm text-red-800'
            }
          >
            {checkoutMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Sending…' : 'Pay'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCart(cloneCart(starterCart()))
              setCheckoutMessage(null)
              setCheckoutTone(null)
            }}
          >
            Reset demo cart
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
