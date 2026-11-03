export const STAGING_REF: string
export const PROD_REF: string

export type PreviewPlan =
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string }
  | { action: 'deploy'; host: 'vercel' | 'cloudflare' }

export function planPreview(env: Record<string, string | undefined>): PreviewPlan
