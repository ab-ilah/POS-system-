import { describe, expect, it } from 'vitest'
import { planPreview, PROD_HOST, STAGING_HOST } from '../../scripts/preview.mjs'

const stagingUrl = `https://${STAGING_HOST}`
const prodUrl = `https://${PROD_HOST}`

describe('planPreview', () => {
  it('skips when no URL is configured', () => {
    expect(planPreview({})).toMatchObject({ action: 'skip' })
  })

  it('accepts only the exact staging origin', () => {
    expect(planPreview({ VITE_SUPABASE_URL: stagingUrl, VITE_SUPABASE_ANON_KEY: 'anon-placeholder' })).toEqual({
      action: 'build',
    })
    expect(planPreview({ VITE_SUPABASE_URL: `${stagingUrl}/`, VITE_SUPABASE_ANON_KEY: 'anon-placeholder' })).toEqual({
      action: 'build',
    })
  })

  it('refuses the production origin and lookalike URLs', () => {
    const prod = planPreview({ VITE_SUPABASE_URL: prodUrl, VITE_SUPABASE_ANON_KEY: 'anon-placeholder' })
    expect(prod.action).toBe('fail')
    if (prod.action === 'fail') expect(prod.reason).not.toContain(prodUrl)

    expect(planPreview({ VITE_SUPABASE_URL: `https://example.com/?q=${STAGING_HOST}` }).action).toBe('fail')
    expect(planPreview({ VITE_SUPABASE_URL: `https://${STAGING_HOST}.evil.example` }).action).toBe('fail')
    expect(planPreview({ VITE_SUPABASE_URL: `https://evil.example/${STAGING_HOST}` }).action).toBe('fail')
    expect(planPreview({ VITE_SUPABASE_URL: `http://${STAGING_HOST}` }).action).toBe('fail')
    expect(planPreview({ VITE_SUPABASE_URL: `${stagingUrl}/rest/v1` }).action).toBe('fail')
  })

  it('does not treat host tokens as a reason to deploy', () => {
    expect(
      planPreview({
        VITE_SUPABASE_URL: stagingUrl,
        VITE_SUPABASE_ANON_KEY: 'anon-placeholder',
        VERCEL_TOKEN: 'token',
        CLOUDFLARE_API_TOKEN: 'token',
      }),
    ).toEqual({ action: 'build' })
  })

  it('skips the build when the staging origin is set and the anon key is missing', () => {
    expect(planPreview({ VITE_SUPABASE_URL: stagingUrl })).toMatchObject({ action: 'skip' })
  })
})
