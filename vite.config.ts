import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { resolvePosDevE2eAssist } from './scripts/vite-e2e-assist-define.ts'

// Offline strategy is a later ADR. The plugin stays installed and disabled.
export default defineConfig(({ command, mode }) => ({
  define: {
    __POS_DEV_E2E_ASSIST__: JSON.stringify(resolvePosDevE2eAssist({ command, mode })),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
}))