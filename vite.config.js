import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import catwatchRiskMapDataHandler from './api/catwatch-risk-map-data.js'
import victorianSuburbsHandler from './api/victorian-suburbs.js'
import catScoreboardDataHandler from './api/cat-scoreboard-data.js'
import catImpactScoreDataHandler from './api/cat-impact-score-data.js'
import catImpactScoreFormulaHandler from './api/cat-impact-score-formula.js'
import missionStatisticsHandler from './api/mission-statistics.js'
import wildlifePhotoIdentificationHandler from './api/wildlife-photo-identification.js'
import nativeSpeciesOptionsHandler from './api/native-species-options.js'
import speciesSightingInsightsHandler from './api/species-sighting-insights.js'
import speciesSightingReportsHandler from './api/species-sighting-reports.js'
import catwatchAuthenticationHandler from './api/catwatch-authentication.js'
import communityLeaderboardHandler from './api/community-leaderboard.js'
import roamingLogEntryHandler from './api/roaming-log-entry.js'

// Adapt function-style handler into Vite middleware.
const createApiMiddleware = (handler) => async (req, res) => {
  // Give Vite requests the same API shape as deployment.
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
        // Register local API routes for development.
        server.middlewares.use('/api/catwatch-risk-map-data', createApiMiddleware(catwatchRiskMapDataHandler))
        server.middlewares.use('/api/victorian-suburbs', createApiMiddleware(victorianSuburbsHandler))
        server.middlewares.use('/api/cat-scoreboard-data', createApiMiddleware(catScoreboardDataHandler))
        server.middlewares.use('/api/cat-impact-score-data', createApiMiddleware(catImpactScoreDataHandler))
        server.middlewares.use('/api/cat-impact-score-formula', createApiMiddleware(catImpactScoreFormulaHandler))
        server.middlewares.use('/api/mission-statistics', createApiMiddleware(missionStatisticsHandler))
        server.middlewares.use('/api/catwatch-authentication', createApiMiddleware(catwatchAuthenticationHandler))
        server.middlewares.use('/api/community-leaderboard', createApiMiddleware(communityLeaderboardHandler))
        server.middlewares.use('/api/roaming-log-entry', createApiMiddleware(roamingLogEntryHandler))
        // Register photo identifier feature endpoints.
        server.middlewares.use(
          '/api/wildlife-photo-identification',
          createApiMiddleware(wildlifePhotoIdentificationHandler),
        )
        server.middlewares.use('/api/native-species-options', createApiMiddleware(nativeSpeciesOptionsHandler))
        server.middlewares.use(
          '/api/species-sighting-insights',
          createApiMiddleware(speciesSightingInsightsHandler),
        )
        server.middlewares.use(
          '/api/species-sighting-reports',
          createApiMiddleware(speciesSightingReportsHandler),
        )
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
