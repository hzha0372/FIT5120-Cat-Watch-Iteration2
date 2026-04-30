/* eslint-env node */
/* global process */
import { Pool } from 'pg'

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'P@ssw0rd',
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
export default async function handler(req, res) {
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
