import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import catwatchHandler from './api/catwatch.js'
import suburbsHandler from './api/suburbs.js'
import impactDashboardHandler from './api/impact-dashboard.js'
import missionStatsHandler from './api/mission-stats.js'

// Adapt function-style handler into Vite middleware.
const createApiMiddleware = (handler) => async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  const query = Object.fromEntries(url.searchParams.entries())
  const reqLike = Object.assign(req, { query })

  const resLike = {
    status(code) {
      res.statusCode = code
      return this
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(payload))
    },
  }

  try {
    await handler(reqLike, resLike)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: error?.message || 'Unexpected error' }))
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    {
      name: 'local-api-routes',
      configureServer(server) {
        server.middlewares.use('/api/catwatch', createApiMiddleware(catwatchHandler))
        server.middlewares.use('/api/suburbs', createApiMiddleware(suburbsHandler))
        server.middlewares.use('/api/impact-dashboard', createApiMiddleware(impactDashboardHandler))
        server.middlewares.use('/api/mission-stats', createApiMiddleware(missionStatsHandler))
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
