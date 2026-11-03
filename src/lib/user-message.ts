export const EMPTY_ERROR_FALLBACK = 'Something went wrong. Please try again.'
export const UNAVAILABLE_ERROR_FALLBACK = 'The service is unavailable. Please try again.'

export function userMessageFromFailure(input: { status?: number; body?: string | null }): string {
  const body = input.body?.trim() ?? ''
  if (body) return body
  if (input.status === 503) return UNAVAILABLE_ERROR_FALLBACK
  return EMPTY_ERROR_FALLBACK
}
