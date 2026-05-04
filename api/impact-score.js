import { Pool } from 'pg'

// Impact Score page JS.
// Owns score data, formula weights, and suburb suggestions used by CatImpactScoreView.vue.
// Vercel entry: /api/impact-score, with action=formula or action=suburbs for supporting sections.
let impactScoreDataHandler
{
/* eslint-env node */
/* global process */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
  database: 'echoes_of_earth',
}

// These weights define how the three database backed component scores add up to the final Cat Impact Score.
const COMPONENT_WEIGHTS = {
  containmentGap: 45,
  wildlifeDensity: 35,
  roamingCatDensity: 20,
}

let pool = null

// Convert database numeric values into safe JavaScript numbers for API responses.
const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// Convert count like values into rounded integers for display and ranking rows.
const toInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

const cleanPostcode = (value) => String(value || '').trim()

// Reuse one PostgreSQL pool per server process and allow environment overrides.
const getPool = () => {
  if (pool) return pool
  const hasUrl = Boolean(process.env.DATABASE_URL)
  const config = hasUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || DEFAULT_DB_CONFIG.host,
        port: Number(process.env.PGPORT || DEFAULT_DB_CONFIG.port),
        user: process.env.PGUSER || DEFAULT_DB_CONFIG.user,
        password: process.env.PGPASSWORD || DEFAULT_DB_CONFIG.password,
        database: process.env.PGDATABASE || DEFAULT_DB_CONFIG.database,
      }

  if (process.env.NODE_ENV === 'production' && hasUrl) {
    config.ssl = { rejectUnauthorized: false }
  }

  pool = new Pool(config)
  return pool
}

// Translate the total score into the three visual risk bands used by the frontend.
const riskLevelForScore = (score) => {
  if (score > 70) {
    return {
      key: 'high',
      label: 'High impact area',
      shortLabel: 'High impact',
      description: 'Score above 70',
    }
  }

  if (score >= 40) {
    return {
      key: 'medium',
      label: 'Medium impact area',
      shortLabel: 'Medium impact',
      description: 'Score in the 40-70 range',
    }
  }

  return {
    key: 'lower',
    label: 'Lower risk area',
    shortLabel: 'Lower risk',
    description: 'Score below 40',
  }
}

// Send timestamps as ISO strings so the client can render local time safely.
const formatUpdatedAt = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

// Prefer source text stored in the database, with named fallbacks for missing metadata.
const sourceText = (source, fallback) => {
  const text = String(source || '').trim()
  return text || fallback
}

// Load source labels and ownership rate metadata used in the score explanation.
const getSources = async (db) => {
  const [statsResult, ownershipResult] = await Promise.all([
    db.query(
      `SELECT stat_name, stat_value, source, notes
       FROM cats_behaviour_stats
       WHERE stat_name IN ('containment_gap_pct', 'outdoor_cat_pct')`,
    ),
    db.query(
      `SELECT state, ownership_pct, source
       FROM cat_ownership_rates
       WHERE state = 'VIC'
       LIMIT 1`,
    ),
  ])

  const stats = new Map()
  for (const row of statsResult.rows || []) {
    stats.set(String(row.stat_name || '').trim(), row)
  }

  const containment = stats.get('containment_gap_pct')
  const outdoor = stats.get('outdoor_cat_pct')
  const ownership = ownershipResult.rows?.[0] || null

  return {
    containmentGap: sourceText(containment?.source, 'SA Cat Containment Survey 2024'),
    wildlifeDensity: 'Atlas of Living Australia',
    roamingCatDensity: 'ABS Census 2021 + Legge et al. 2020',
    ownershipRate: ownership ? toNum(ownership.ownership_pct, 34) : 34,
    outdoorCatRate: outdoor ? toNum(outdoor.stat_value, 0) : 0,
  }
}

// Transform one suburb_scores row into the three weighted cards shown on the Impact Score page.
const buildComponentRows = (row, sources) => [
  {
    key: 'containmentGap',
    label: 'Containment Gap',
    weightPct: COMPONENT_WEIGHTS.containmentGap,
    score: toNum(row.containment_gap_score),
    maxPoints: COMPONENT_WEIGHTS.containmentGap,
    rawValue: toNum(row.containment_gap_raw),
    rawUnit: '%',
    rawDisplay: `${toNum(row.containment_gap_raw).toFixed(1)}% of cat owners using no containment`,
    source: sources.containmentGap,
    tableField: 'suburb_scores.containment_gap_raw',
  },
  {
    key: 'wildlifeDensity',
    label: 'Wildlife Density',
    weightPct: COMPONENT_WEIGHTS.wildlifeDensity,
    score: toNum(row.wildlife_density_score),
    maxPoints: COMPONENT_WEIGHTS.wildlifeDensity,
    rawValue: toInt(row.wildlife_density_raw),
    rawUnit: 'records',
    rawDisplay: `${toInt(row.wildlife_density_raw).toLocaleString()} FFG Act threatened species records within 5km`,
    source: sources.wildlifeDensity,
    tableField: 'suburb_scores.wildlife_density_raw',
  },
  {
    key: 'roamingCatDensity',
    label: 'Roaming Cat Density',
    weightPct: COMPONENT_WEIGHTS.roamingCatDensity,
    score: toNum(row.cat_density_score),
    maxPoints: COMPONENT_WEIGHTS.roamingCatDensity,
    rawValue: toInt(row.cat_density_raw),
    rawUnit: 'cats',
    rawDisplay: `${toInt(row.cat_density_raw).toLocaleString()} estimated roaming pet cats`,
    source: sources.roamingCatDensity,
    tableField: 'suburb_scores.cat_density_raw',
  },
]

// Build the full LGA comparison list directly from pre computed suburb score rows.
const getRankingRows = async (db, lgaName) => {
  const result = await db.query(
    `SELECT TRIM(s.postcode) AS postcode,
            d.suburb_name,
            d.lga_name,
            s.total_impact_score,
            s.lga_percentile_rank,
            s.containment_gap_raw,
            s.cat_density_raw
     FROM suburb_scores s
     JOIN suburb_demographics d ON TRIM(d.postcode) = TRIM(s.postcode)
     WHERE d.state = 'VIC'
       AND d.lga_name = $1
     ORDER BY s.total_impact_score DESC NULLS LAST,
              d.suburb_name ASC,
              TRIM(s.postcode) ASC`,
    [lgaName],
  )

  const total = result.rows.length
  return result.rows.map((row, index) => {
    const percentileRank = toNum(row.lga_percentile_rank, Number.NaN)
    const rankTopPercent = total > 0 ? Math.max(1, Math.round(((index + 1) / total) * 100)) : 100

    return {
      position: index + 1,
      postcode: cleanPostcode(row.postcode),
      suburbName: String(row.suburb_name || '').trim() || cleanPostcode(row.postcode),
      lgaName: String(row.lga_name || '').trim(),
      totalScore: toNum(row.total_impact_score),
      percentileRank: Number.isFinite(percentileRank) ? percentileRank : null,
      topPercent: rankTopPercent,
      isTop30: rankTopPercent <= 30,
      containmentGapRaw: toNum(row.containment_gap_raw),
      roamingCatsRaw: toInt(row.cat_density_raw),
    }
  })
}

// Return a stable ranking window for the UI.
const buildRankingWindow = (rows, selectedPostcode, size = 8) => {
  const list = Array.isArray(rows) ? rows : []
  if (list.length <= size) return list

  const currentIndex = list.findIndex((item) => item.postcode === selectedPostcode)
  if (currentIndex < 0) return list.slice(0, size)

  const half = Math.floor(size / 2)
  let start = currentIndex - half
  start = Math.max(0, Math.min(start, list.length - size))
  return list.slice(start, start + size)
}

// Assemble the complete page payload for one postcode from database backed score and suburb tables.
const getImpactScore = async (postcode) => {
  const db = getPool()
  const targetResult = await db.query(
    `SELECT TRIM(s.postcode) AS postcode,
            d.suburb_name,
            d.lga_name,
            d.household_count,
            d.population,
            s.containment_gap_raw,
            s.containment_gap_score,
            s.wildlife_density_raw,
            s.wildlife_density_score,
            s.cat_density_raw,
            s.cat_density_score,
            s.total_impact_score,
            s.lga_percentile_rank,
            s.last_updated
     FROM suburb_scores s
     JOIN suburb_demographics d ON TRIM(d.postcode) = TRIM(s.postcode)
     WHERE d.state = 'VIC'
       AND TRIM(s.postcode) = $1
     LIMIT 1`,
    [postcode],
  )

  if (!targetResult.rows.length) {
    throw new Error(`No pre-computed Cat Impact Score found for Victorian postcode ${postcode}.`)
  }

  const row = targetResult.rows[0]
  const lgaName = String(row.lga_name || '').trim()
  const [sources, rankingRows] = await Promise.all([getSources(db), getRankingRows(db, lgaName)])
  const selectedPostcode = cleanPostcode(row.postcode)
  const markedRankingRows = rankingRows.map((item) => ({
    ...item,
    isCurrent: item.postcode === selectedPostcode,
  }))
  const currentRank = markedRankingRows.find((item) => item.postcode === selectedPostcode) || null
  const rankingWindow = buildRankingWindow(markedRankingRows, selectedPostcode)
  const totalScore = toNum(row.total_impact_score)

  return {
    location: {
      postcode: selectedPostcode,
      suburbName: String(row.suburb_name || '').trim() || selectedPostcode,
      lgaName,
      householdCount: toInt(row.household_count),
      population: toInt(row.population),
    },
    score: {
      total: totalScore,
      risk: riskLevelForScore(totalScore),
      lastUpdated: formatUpdatedAt(row.last_updated),
    },
    components: buildComponentRows(row, sources),
    ranking: {
      lgaName,
      totalSuburbs: rankingRows.length,
      current: currentRank
        ? {
            ...currentRank,
            isCurrent: true,
          }
        : null,
      rows: rankingWindow,
    },
    formula: {
      note: 'All score values are read from pre-computed database rows in suburb_scores.',
      weights: COMPONENT_WEIGHTS,
      petCatsOnly: true,
      roamingCatEstimate: {
        householdCount: toInt(row.household_count),
        ownershipRatePct: sources.ownershipRate,
        outdoorRatePct: sources.outdoorCatRate,
      },
    },
  }
}

// API entry point used by Vite middleware and serverless style handlers.
impactScoreDataHandler = async function(req, res) {
  try {
    const postcode = cleanPostcode(req.query?.postcode)

    if (!/^\d{4}$/.test(postcode)) {
      res.status(400).json({ error: 'Please enter a valid 4-digit Victorian postcode.' })
      return
    }

    const data = await getImpactScore(postcode)
    res.status(200).json(data)
  } catch (error) {
    const message = error?.message || 'Unable to load Cat Impact Score.'
    const status = message.startsWith('No pre-computed') ? 404 : 500
    res.status(status).json({ error: message })
  }
}

}

let impactScoreFormulaHandler
{
/* eslint-env node */
/* global process */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
  database: 'echoes_of_earth',
}

const SCORE_COMPONENTS = [
  {
    key: 'containmentGap',
    label: 'Containment gap',
    weightPct: 45,
    tone: 'weight-red',
    sourceStatName: 'containment_gap_pct',
  },
  {
    key: 'wildlifeDensity',
    label: 'Wildlife density',
    weightPct: 35,
    tone: 'weight-blue',
    sourceStatName: null,
  },
  {
    key: 'roamingCatDensity',
    label: 'Roaming cat density',
    weightPct: 20,
    tone: 'weight-yellow',
    sourceStatName: 'outdoor_cat_pct',
  },
]

let pool = null

const toInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

const getPool = () => {
  if (pool) return pool
  const hasUrl = Boolean(process.env.DATABASE_URL)
  const config = hasUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || DEFAULT_DB_CONFIG.host,
        port: Number(process.env.PGPORT || DEFAULT_DB_CONFIG.port),
        user: process.env.PGUSER || DEFAULT_DB_CONFIG.user,
        password: process.env.PGPASSWORD || DEFAULT_DB_CONFIG.password,
        database: process.env.PGDATABASE || DEFAULT_DB_CONFIG.database,
      }

  if (process.env.NODE_ENV === 'production' && hasUrl) {
    config.ssl = { rejectUnauthorized: false }
  }

  pool = new Pool(config)
  return pool
}

// Return the scoring model displayed before a suburb is searched.
impactScoreFormulaHandler = async function(req, res) {
  try {
    const db = getPool()
    const [scoreRowsResult, statsResult] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS row_count FROM suburb_scores`),
      db.query(
        `SELECT stat_name, source, notes
         FROM cats_behaviour_stats
         WHERE stat_name IN ('containment_gap_pct', 'outdoor_cat_pct')`,
      ),
    ])

    const scoreRows = toInt(scoreRowsResult.rows?.[0]?.row_count)
    if (scoreRows <= 0) {
      res.status(503).json({ error: 'No database rows found in suburb_scores.', components: [] })
      return
    }

    const sourceByName = new Map()
    for (const row of statsResult.rows || []) {
      sourceByName.set(String(row.stat_name || '').trim(), {
        source: row.source || '',
        notes: row.notes || '',
      })
    }

    res.status(200).json({
      components: SCORE_COMPONENTS.map((item) => {
        const sourceMeta = item.sourceStatName ? sourceByName.get(item.sourceStatName) : null
        return {
          key: item.key,
          label: item.label,
          weightPct: item.weightPct,
          tone: item.tone,
          source:
            sourceMeta?.source ||
            (item.key === 'wildlifeDensity'
              ? 'Atlas of Living Australia via species_cache'
              : 'CatWatch scoring model'),
          notes:
            sourceMeta?.notes ||
            'Weight used by the CatWatch impact score formula stored in suburb_scores.',
        }
      }),
      databaseCoverage: {
        suburbScoreRows: scoreRows,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load impact formula.', components: [] })
  }
}

}

let impactScoreSuburbsHandler
{
/* eslint-env node */
/* global process */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
  database: 'echoes_of_earth',
}

let pool = null

// Get and reuse database connection pool.
const getPool = () => {
  if (pool) return pool
  const hasUrl = Boolean(process.env.DATABASE_URL)

  const config = hasUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || DEFAULT_DB_CONFIG.host,
        port: Number(process.env.PGPORT || DEFAULT_DB_CONFIG.port),
        user: process.env.PGUSER || DEFAULT_DB_CONFIG.user,
        password: process.env.PGPASSWORD || DEFAULT_DB_CONFIG.password,
        database: process.env.PGDATABASE || DEFAULT_DB_CONFIG.database,
      }

  if (process.env.NODE_ENV === 'production' && hasUrl) {
    config.ssl = { rejectUnauthorized: false }
  }

  pool = new Pool(config)
  return pool
}

// Handle API request and return aggregated response data.
impactScoreSuburbsHandler = async function(req, res) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.max(1, Math.min(12, Number(req.query.limit) || 8))

    if (!q) {
      res.status(200).json({ results: [] })
      return
    }

    const query = String(q).toLowerCase()
    const postcodePrefix = query.match(/^(\d{1,4})/)?.[1] || ''
    const isPostcode = Boolean(postcodePrefix)

    const db = getPool()
    // Search only Victorian suburb_demographics rows.
    const result = await db.query(
      `SELECT TRIM(postcode) AS postcode, suburb_name, centroid_lat, centroid_lng, population
       FROM suburb_demographics
       WHERE state = 'VIC'
         AND (
           suburb_name ILIKE $1
           OR CAST(TRIM(postcode) AS TEXT) LIKE $2
         )
       ORDER BY
         CASE
           WHEN CAST(TRIM(postcode) AS TEXT) = $3 THEN 0
           WHEN suburb_name ILIKE $4 AND LOWER(TRIM(suburb_name)) <> LOWER(TRIM(postcode)) THEN 0
           ELSE 1
         END,
         CASE
           WHEN LOWER(TRIM(suburb_name)) = LOWER(TRIM(postcode)) THEN 1
           ELSE 0
         END,
         population DESC NULLS LAST,
         suburb_name ASC
       LIMIT $5`,
      [`%${q}%`, `${isPostcode ? postcodePrefix : query}%`, isPostcode ? postcodePrefix : '', `${q}%`, limit * 3],
    )

    const rows = result.rows || []
    const dedup = new Map()
    for (const row of rows) {
      const postcode = String(row.postcode || '')
      const name = String(row.suburb_name || '').trim()
      if (!postcode || !name) continue
      // Some source rows use the postcode as the suburb name.
      const hasRealName = name.toLowerCase() !== postcode.toLowerCase()
      const label = isPostcode && hasRealName ? `${postcode} · ${name}` : hasRealName ? name : postcode
      const displayQuery = hasRealName ? `${postcode} ${name}` : postcode
      if (!dedup.has(postcode)) {
        dedup.set(postcode, {
          id: `${postcode}-${name}`,
          name,
          postcode,
          lat: Number(row.centroid_lat),
          lng: Number(row.centroid_lng),
          label,
          displayQuery,
        })
      }
    }

    res.status(200).json({ results: Array.from(dedup.values()).slice(0, limit) })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Suburb lookup failed', results: [] })
  }
}

}

export default async function impactScoreHandler(req, res) {
  const action = String(req.query?.action || req.featureAction || 'data')
  if (action === 'formula') return impactScoreFormulaHandler(req, res)
  if (action === 'suburbs') return impactScoreSuburbsHandler(req, res)
  return impactScoreDataHandler(req, res)
}
