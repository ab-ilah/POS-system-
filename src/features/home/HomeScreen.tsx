import { useQuery } from '@tanstack/react-query'
import { Shell } from '@/app/Shell.tsx'
import { CheckoutPanel } from '@/features/checkout/CheckoutPanel.tsx'
import { isSupabaseConfigured } from '@/lib/data/index.ts'
import { formatGhs, shelfPriceFromCedis } from '@/lib/money.ts'

const exampleShelfPrice = formatGhs(shelfPriceFromCedis(189, 0))

export function HomeScreen() {
  const config = useQuery({
    queryKey: ['supabase-config'],
    queryFn: () => isSupabaseConfigured(),
    initialData: isSupabaseConfigured(),
  })

  return (
    <Shell>
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Register</h1>
        <p className="max-w-xl text-muted-foreground">
          Shelf prices are tax-inclusive and kept as whole pesewas. The till formats them as Ghana cedis.
        </p>
        <p className="text-lg">
          Example shelf price <span className="font-semibold">{exampleShelfPrice}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {config.data
            ? 'Supabase environment is set.'
            : 'Supabase environment is not set. Copy .env.example to .env.local.'}
        </p>
        <CheckoutPanel />
      </section>
    </Shell>
  )
}
