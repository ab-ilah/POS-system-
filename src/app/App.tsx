import { AppProviders } from './providers.tsx'
import { AppRouter } from './router.tsx'

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
