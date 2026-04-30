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
        server.middlewares.use('/api/cat-scoreboard', createApiMiddleware(catScoreboardHandler))
        server.middlewares.use('/api/cat-impact-score', createApiMiddleware(catImpactScoreHandler))
        server.middlewares.use('/api/impact-formula', createApiMiddleware(impactFormulaHandler))
        server.middlewares.use('/api/mission-stats', createApiMiddleware(missionStatsHandler))
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
