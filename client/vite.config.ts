import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend URL - defaults to localhost if not set
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3001'
  const isSecure = backendUrl.startsWith('https://')

  const config: any = {
    plugins: [react()],
    define: {},
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: isSecure,
        },
      },
    },
  }

  // Set VITE_API_URL so requests go through proxy
  config.define['import.meta.env.VITE_API_URL'] = JSON.stringify('http://localhost:3000')

  return config
})
