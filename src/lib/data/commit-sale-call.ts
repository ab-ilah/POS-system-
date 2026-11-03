export const COMMIT_SALE_TIMEOUT_MS = 10_000

export class CommitSaleTimeoutError extends Error {
  constructor() {
    super('The sale request timed out. Please try again.')
    this.name = 'CommitSaleTimeoutError'
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function once<T>(attempt: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await attempt(controller.signal)
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) throw new CommitSaleTimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function commitSaleWithTimeout<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  timeoutMs = COMMIT_SALE_TIMEOUT_MS,
): Promise<T> {
  try {
    return await once(attempt, timeoutMs)
  } catch (error) {
    if (!(error instanceof CommitSaleTimeoutError)) throw error
    return await once(attempt, timeoutMs)
  }
}
