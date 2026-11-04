import { describe, expect, it } from 'vitest'
import { signIn, visibleSignInMessage } from '../../src/lib/data/auth.ts'
import { EMPTY_ERROR_FALLBACK, UNAVAILABLE_ERROR_FALLBACK } from '../../src/lib/user-message.ts'

describe('signIn', () => {
  it('does not call Supabase when the gateway is missing', async () => {
    const result = await signIn({ email: 'cashier@example.com', password: 'secret' }, null)
    expect(result).toEqual({
      ok: false,
      message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    })
  })

  it('returns the gateway error without inventing a session', async () => {
    const result = await signIn(
      { email: 'cashier@example.com', password: 'secret' },
      {
        signInWithPassword: async () => ({ error: { message: 'Invalid login credentials' } }),
      },
    )
    expect(result).toEqual({ ok: false, message: 'Invalid login credentials' })
  })

  it('propagates thrown gateway failures such as a network error', async () => {
    await expect(
      signIn(
        { email: 'cashier@example.com', password: 'secret' },
        {
          signInWithPassword: async () => {
            throw new TypeError('Failed to fetch')
          },
        },
      ),
    ).rejects.toThrow('Failed to fetch')
  })

  it('uses a fallback when a 503 or any other error has an empty body', async () => {
    const unavailable = await signIn(
      { email: 'cashier@example.com', password: 'secret' },
      { signInWithPassword: async () => ({ error: { message: '', status: 503 } }) },
    )
    const empty = await signIn(
      { email: 'cashier@example.com', password: 'secret' },
      { signInWithPassword: async () => ({ error: { message: '   ', status: 500 } }) },
    )
    expect(unavailable).toEqual({ ok: false, message: UNAVAILABLE_ERROR_FALLBACK })
    expect(empty).toEqual({ ok: false, message: EMPTY_ERROR_FALLBACK })
  })

  it('returns ok when the gateway accepts the password', async () => {
    const result = await signIn(
      { email: 'cashier@example.com', password: 'secret' },
      { signInWithPassword: async () => ({ error: null }) },
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('visibleSignInMessage', () => {
  it('shows a thrown error when the gateway did not return one', () => {
    expect(
      visibleSignInMessage({
        formError: null,
        result: undefined,
        thrown: new TypeError('Failed to fetch'),
      }),
    ).toBe('Failed to fetch')
  })

  it('prefers a returned auth error over a stale throw', () => {
    expect(
      visibleSignInMessage({
        formError: null,
        result: { ok: false, message: 'Invalid login credentials' },
        thrown: new Error('Failed to fetch'),
      }),
    ).toBe('Invalid login credentials')
  })
})
