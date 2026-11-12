import { Shell } from '@/app/Shell.tsx'

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Shell>
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">Screen placeholder for POS-04 navigation gating.</p>
      </section>
    </Shell>
  )
}
