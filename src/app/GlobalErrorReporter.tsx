import { useEffect, useState } from 'react'
import { installGlobalErrorHandlers } from './global-errors.ts'

export function GlobalErrorReporter() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => installGlobalErrorHandlers(setMessage), [])

  if (!message) return null
  return <p role="alert">{message}</p>
}
