import { describe, expect, it } from 'vitest'
import { signIn } from '../../src/lib/data/auth.ts'

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

  it('returns ok when the gateway accepts the password', async () => {
    const result = await signIn(
      { email: 'cashier@example.com', password: 'secret' },
      { signInWithPassword: async () => ({ error: null }) },
    )
    expect(result).toEqual({ ok: true })
  })
})
