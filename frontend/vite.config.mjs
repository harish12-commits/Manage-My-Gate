import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

import { fileURLToPath, URL } from 'node:url'

export default defineConfig(() => {
  return {
    base: '/',
    build: {
      outDir: 'build',
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy, rarely-changing vendors so route chunks stay small and cacheable.
          manualChunks(rawId) {
            const id = rawId.split(path.sep).join('/')
            if (!id.includes('/node_modules/')) return undefined
            if (
              /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)
            )
              return 'vendor-react'
            if (
              /\/node_modules\/@coreui\/(chartjs|react-chartjs)\/|\/node_modules\/chart\.js\//.test(
                id,
              )
            )
              return 'vendor-charts'
            if (id.includes('/node_modules/@coreui/')) return 'vendor-coreui'
            if (id.includes('/node_modules/@fullcalendar/')) return 'vendor-calendar'
            if (/\/node_modules\/(xlsx|file-saver)\//.test(id)) return 'vendor-xlsx'
            if (/\/node_modules\/(@azure|@react-oauth)\//.test(id)) return 'vendor-auth'
            return undefined
          },
        },
      },
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        'src/': `${fileURLToPath(new URL('./src', import.meta.url)).replace(/\\/g, '/')}/`,
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    server: {
      port: 3004,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5002',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (['ECONNRESET', 'ECONNABORTED', 'ECONNREFUSED'].includes(err.code)) return
              console.warn('[vite-proxy-api-error]', err)
            })
          },
        },
        '/socket.io': {
          target: 'http://127.0.0.1:5002',
          ws: true,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if (['ECONNRESET', 'ECONNABORTED', 'ECONNREFUSED'].includes(err.code)) return
              console.warn('[vite-proxy-ws-error]', err)
            })
          },
        },
        '/public': {
          target: 'http://127.0.0.1:5002',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:5002',
          changeOrigin: true,
        },
      },
    },
  }
})
// trigger restart
