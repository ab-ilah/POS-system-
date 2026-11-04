export const STAGING_HOST: string
export const PROD_HOST: string

export function supabaseProjectHost(value: string): string | null

export type PreviewPlan =
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string }
  | { action: 'build' }

export function planPreview(env: Record<string, string | undefined>): PreviewPlan
