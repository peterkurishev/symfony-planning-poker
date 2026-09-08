import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const apiTarget = process.env.API_URL ?? 'http://localhost:8080'

export default defineConfig({
  // Автоимпорт компонентов Vuetify: в бандл попадают только используемые.
  plugins: [vue(), vuetify({ autoImport: true })],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Контейнер e2e ходит на dev-сервер по имени сервиса.
    allowedHosts: ['frontend'],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
            }
          })
        },
      },
    },
  },
})
