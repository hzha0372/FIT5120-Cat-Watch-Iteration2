import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import catwatchHandler from './api/catwatch.js'
import suburbsHandler from './api/suburbs.js'
import catScoreboardHandler from './api/cat-scoreboard.js'
import catImpactScoreHandler from './api/cat-impact-score.js'
import impactFormulaHandler from './api/impact-formula.js'
import missionStatsHandler from './api/mission-stats.js'
import epic3IdentifyHandler from './api/epic3-identify.js'
import nativeSpeciesHandler from './api/native-species.js'
import speciesInsightsHandler from './api/species-insights.js'
import sightingReportsHandler from './api/sighting-reports.js'

// Adapt function-style handler into Vite middleware.
const createApiMiddleware = (handler) => async (req, res) => {
  // Vercel-style API handlers expect req.query and res.status().json().
  // Vite middleware receives raw Node req/res, so this adapter gives local dev
  // the same interface as deployment without duplicating API code.
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
        // Register local API routes so the Vue app can call /api/... during
        // development. Production deployment uses the same handler files.
        server.middlewares.use('/api/catwatch', createApiMiddleware(catwatchHandler))
        server.middlewares.use('/api/suburbs', createApiMiddleware(suburbsHandler))
        server.middlewares.use('/api/cat-scoreboard', createApiMiddleware(catScoreboardHandler))
        server.middlewares.use('/api/cat-impact-score', createApiMiddleware(catImpactScoreHandler))
        server.middlewares.use('/api/impact-formula', createApiMiddleware(impactFormulaHandler))
        server.middlewares.use('/api/mission-stats', createApiMiddleware(missionStatsHandler))
        // Epic 3 feature endpoints:
        // - epic3-identify proxies the remote computer vision service.
        // - native-species fills the manual confirmation dropdown.
        // - species-insights returns conservation/local sighting details.
        // - sighting-reports saves confirmed sightings for community map pins.
        server.middlewares.use('/api/epic3-identify', createApiMiddleware(epic3IdentifyHandler))
        server.middlewares.use('/api/native-species', createApiMiddleware(nativeSpeciesHandler))
        server.middlewares.use('/api/species-insights', createApiMiddleware(speciesInsightsHandler))
        server.middlewares.use('/api/sighting-reports', createApiMiddleware(sightingReportsHandler))
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
