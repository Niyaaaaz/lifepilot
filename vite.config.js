import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const defaultApiTarget = 'http://127.0.0.1:3000'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || defaultApiTarget,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
  }
})
