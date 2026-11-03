import { Component, type ErrorInfo, type ReactNode } from 'react'
import { EMPTY_ERROR_FALLBACK } from '../lib/user-message.ts'

type State = { message: string | null }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message.trim() : ''
    return { message: message || EMPTY_ERROR_FALLBACK }
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // The alert below is the user-facing surface. Logging stays at the console.
  }

  render(): ReactNode {
    if (this.state.message) {
      return <p role="alert">{this.state.message}</p>
    }
    return this.props.children
  }
}
