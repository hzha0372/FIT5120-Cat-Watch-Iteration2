import catImpactScoreDataHandler from './api-handlers/cat-impact-score-data.js'
import catImpactScoreFormulaHandler from './api-handlers/cat-impact-score-formula.js'
import catScoreboardDataHandler from './api-handlers/cat-scoreboard-data.js'
import catwatchAuthenticationHandler from './api-handlers/catwatch-authentication.js'
import catwatchRiskMapDataHandler from './api-handlers/catwatch-risk-map-data.js'
import communityLeaderboardHandler from './api-handlers/community-leaderboard.js'
import missionStatisticsHandler from './api-handlers/mission-statistics.js'
import nativeSpeciesOptionsHandler from './api-handlers/native-species-options.js'
import roamingLogEntryHandler from './api-handlers/roaming-log-entry.js'
import speciesSightingInsightsHandler from './api-handlers/species-sighting-insights.js'
import speciesSightingReportsHandler from './api-handlers/species-sighting-reports.js'
import victorianSuburbsHandler from './api-handlers/victorian-suburbs.js'
import wildlifePhotoIdentificationHandler from './api-handlers/wildlife-photo-identification.js'

const handlers = {
  'cat-impact-score-data': catImpactScoreDataHandler,
  'cat-impact-score-formula': catImpactScoreFormulaHandler,
  'cat-scoreboard-data': catScoreboardDataHandler,
  'catwatch-authentication': catwatchAuthenticationHandler,
  'catwatch-risk-map-data': catwatchRiskMapDataHandler,
  'community-leaderboard': communityLeaderboardHandler,
  'mission-statistics': missionStatisticsHandler,
  'native-species-options': nativeSpeciesOptionsHandler,
  'roaming-log-entry': roamingLogEntryHandler,
  'species-sighting-insights': speciesSightingInsightsHandler,
  'species-sighting-reports': speciesSightingReportsHandler,
  'victorian-suburbs': victorianSuburbsHandler,
  'wildlife-photo-identification': wildlifePhotoIdentificationHandler,
}

const routeFromQuery = (route) => {
  if (Array.isArray(route)) return route.join('/')
  return typeof route === 'string' ? route : ''
}

const getRouteName = (req, url) => {
  const fromPath = url.pathname.replace(/^\/api\/?/, '').replace(/^\/+|\/+$/g, '')
  return fromPath || routeFromQuery(req.query?.route)
}

export default async function apiRouter(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  req.query = {
    ...(req.query || {}),
    ...Object.fromEntries(url.searchParams.entries()),
  }

  const routeName = getRouteName(req, url)
  const handler = handlers[routeName]

  delete req.query.route

  if (!handler) {
    res.status(404).json({ error: `Unknown API route: ${routeName || '/'}` })
    return
  }

  await handler(req, res)
}
