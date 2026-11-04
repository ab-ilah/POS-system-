import { AppErrorBoundary } from './AppErrorBoundary.tsx'
import { GlobalErrorReporter } from './GlobalErrorReporter.tsx'
import { AppProviders } from './providers.tsx'
import { AppRouter } from './router.tsx'

export function App() {
  return (
    <AppErrorBoundary>
      <GlobalErrorReporter />
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  )
}
