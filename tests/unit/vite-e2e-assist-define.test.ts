import { describe, expect, it } from 'vitest'
import { resolvePosDevE2eAssist } from '../../scripts/vite-e2e-assist-define.ts'

describe('resolvePosDevE2eAssist', () => {
  it('enables assist only for the dev server with the assist flag', () => {
    expect(
      resolvePosDevE2eAssist({ command: 'serve', mode: 'development', assistFlag: 'true' }),
    ).toBe(true)
    expect(
      resolvePosDevE2eAssist({ command: 'serve', mode: 'development', assistFlag: undefined }),
    ).toBe(false)
  })

  it('stays off for production builds even when the assist flag is set', () => {
    expect(
      resolvePosDevE2eAssist({ command: 'build', mode: 'production', assistFlag: 'true' }),
    ).toBe(false)
    expect(
      resolvePosDevE2eAssist({ command: 'serve', mode: 'production', assistFlag: 'true' }),
    ).toBe(false)
  })
})