import { describe, expect, it } from 'vitest'
import { planPreview, PROD_REF, STAGING_REF } from '../../scripts/preview.mjs'

const stagingUrl = `https://${STAGING_REF}.supabase.co`
const prodUrl = `https://${PROD_REF}.supabase.co`

describe('planPreview', () => {
  it('skips when the host has not been chosen and no URL is configured', () => {
    expect(planPreview({})).toMatchObject({ action: 'skip' })
  })

  it('refuses the production project even when the host is unset', () => {
    const plan = planPreview({ VITE_SUPABASE_URL: prodUrl })
    expect(plan.action).toBe('fail')
    if (plan.action === 'fail') expect(plan.reason).not.toContain(prodUrl)
  })

  it('refuses a URL that is not the staging project', () => {
    expect(planPreview({ VITE_SUPABASE_URL: 'https://example.supabase.co' }).action).toBe('fail')
  })

  it('stays a stub until Gabriel picks a host and supplies the staging anon key', () => {
    expect(planPreview({ VITE_SUPABASE_URL: stagingUrl, VITE_SUPABASE_ANON_KEY: 'anon-placeholder' })).toMatchObject({
      action: 'skip',
    })
    expect(
      planPreview({
        PREVIEW_HOST: 'vercel',
        VITE_SUPABASE_URL: stagingUrl,
        VITE_SUPABASE_ANON_KEY: '',
      }),
    ).toMatchObject({ action: 'skip' })
  })

  it('plans a deploy only for staging with a known host and that host token', () => {
    expect(
      planPreview({
        PREVIEW_HOST: 'cloudflare',
        VITE_SUPABASE_URL: stagingUrl,
        VITE_SUPABASE_ANON_KEY: 'anon-placeholder',
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ACCOUNT_ID: 'account',
      }),
    ).toEqual({ action: 'deploy', host: 'cloudflare' })

    expect(
      planPreview({
        PREVIEW_HOST: 'vercel',
        VITE_SUPABASE_URL: stagingUrl,
        VITE_SUPABASE_ANON_KEY: 'anon-placeholder',
        VERCEL_TOKEN: 'token',
      }),
    ).toEqual({ action: 'deploy', host: 'vercel' })
  })

  it('rejects an unknown host', () => {
    expect(planPreview({ PREVIEW_HOST: 'netlify', VITE_SUPABASE_URL: stagingUrl }).action).toBe('fail')
  })
})
