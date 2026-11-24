export function resolvePosDevE2eAssist(options: {
  command: string
  mode: string
  assistFlag?: string
}): boolean {
  const assist = options.assistFlag ?? process.env.VITE_E2E_ASSIST
  return options.command === 'serve' && options.mode !== 'production' && assist === 'true'
}