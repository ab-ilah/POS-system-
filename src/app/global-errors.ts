import { userMessageFromFailure } from '../lib/user-message.ts'

export function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) return userMessageFromFailure({ body: error.message })
  if (typeof error === 'string') return userMessageFromFailure({ body: error })
  return userMessageFromFailure({})
}

export function installGlobalErrorHandlers(report: (message: string) => void): () => void {
  const onError = (event: Event) => {
    const errorEvent = event as ErrorEvent
    const source = errorEvent.error ?? errorEvent.message
    report(messageFromUnknownError(source))
  }
  const onRejection = (event: Event) => {
    const reason = (event as PromiseRejectionEvent).reason
    report(messageFromUnknownError(reason))
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
