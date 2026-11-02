import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const defaultApiTarget = 'http://127.0.0.1:3000'
const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '')
  const apiProxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || defaultApiTarget,
      changeOrigin: true,
    },
  }

  return {
    root: frontendRoot,
    plugins: [react()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
  }
})
