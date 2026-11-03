import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

async function lint(filePath: string, code: string) {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: 'eslint.config.js',
  })
  const results = await eslint.lintText(code, { filePath })
  return results.flatMap((result) => result.messages.map((message) => message.message))
}

const clientImport = `import { createClient } from '@supabase/supabase-js'
export const client = createClient('http://127.0.0.1:54321', 'public-anon-placeholder')
`

describe('supabase import boundary', () => {
  it('rejects the Supabase package outside the data client module', async () => {
    const messages = await lint('src/features/auth/LoginScreen.tsx', clientImport)
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(true)
  })

  it('rejects a feature importing the client module by relative path', async () => {
    const messages = await lint(
      'src/features/auth/LoginScreen.tsx',
      `import { browserSupabase } from '../../lib/data/supabase.ts'\nexport const load = browserSupabase\n`,
    )
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(true)
  })

  it('rejects a dynamic import of the Supabase package', async () => {
    const messages = await lint(
      'src/components/ui/button.tsx',
      `export async function loadClient() {\n  return import('@supabase/supabase-js')\n}\n`,
    )
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(true)
  })

  it('rejects a resolved client import that does not spell lib/data in the specifier', async () => {
    const messages = await lint(
      'src/lib/money.ts',
      `import { browserSupabase } from './data/supabase.ts'\nexport const load = browserSupabase\n`,
    )
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(true)
  })

  it('rejects a dynamic import of the client module from outside the data layer', async () => {
    const messages = await lint(
      'src/lib/money.ts',
      `export async function load() {\n  return import('./data/supabase.ts')\n}\n`,
    )
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(true)
  })

  it('allows the data layer to import the client module by its resolved path', async () => {
    const messages = await lint(
      'src/lib/data/auth.ts',
      `import { browserSupabase } from './supabase.ts'\nexport const load = browserSupabase\n`,
    )
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(false)
  })

  it('allows the package inside the data client module', async () => {
    const messages = await lint('src/lib/data/supabase.ts', clientImport)
    expect(messages.some((message) => message.includes('data-access layer'))).toBe(false)
  })
})
