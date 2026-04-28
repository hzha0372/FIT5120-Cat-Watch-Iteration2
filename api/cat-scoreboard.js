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

let pool = null

// Safely convert input to integer with fallback.
const toInt = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Safely convert input to number with fallback.
const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Get and reuse database connection pool.
const getPool = () => {
  if (pool) return pool
  const hasUrl = Boolean(process.env.DATABASE_URL)
  const config = hasUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || DEFAULT_DB_CONFIG.host,
        port: toInt(process.env.PGPORT, DEFAULT_DB_CONFIG.port),
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

const riskLevelForScore = (score) => {
  const value = toNum(score, 0)
  if (value > 70) return { key: 'high', label: 'High impact' }
  if (value >= 40) return { key: 'medium', label: 'Medium impact' }
  return { key: 'lower', label: 'Lower impact' }
}

// Query and assemble a statewide Cat Scoreboard from database score rows.
// The scoreboard deliberately does not select a default user or postcode; it is
// a Victoria-wide ranking built from suburb_scores, suburb_demographics, and
// species_cache. That prevents old demo/default suburbs from leaking into the UI.
const getScoreboardData = async () => {
  const db = getPool()

  // Run the summary, wildlife, and ranking queries in parallel because they are
  // independent database reads. All three are required for the page cards:
  // summary cards, threatened record totals, and the Top Rankings list.
  const [statsResult, threatenedResult, rowsResult] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total_regions,
              ROUND(AVG(s.total_impact_score)::numeric, 1)::float AS average_score,
              ROUND(MAX(s.total_impact_score)::numeric, 1)::float AS max_score
       FROM suburb_scores s
       JOIN suburb_demographics d ON TRIM(d.postcode) = TRIM(s.postcode)
       WHERE d.state = 'VIC'
         AND s.total_impact_score IS NOT NULL`,
    ),
    db.query(
      `SELECT COUNT(*)::int AS threatened_records,
              COUNT(DISTINCT LOWER(TRIM(sc.scientific_name)))::int AS threatened_species
       FROM species_cache sc
       JOIN suburb_demographics d ON TRIM(d.postcode) = TRIM(sc.postcode)
       WHERE d.state = 'VIC'
         AND (
           LOWER(COALESCE(sc.state_conservation, '')) LIKE '%critical%'
           OR LOWER(COALESCE(sc.state_conservation, '')) LIKE '%endangered%'
           OR LOWER(COALESCE(sc.state_conservation, '')) LIKE '%vulnerable%'
         )`,
    ),
    db.query(
      `WITH threatened_species AS (
       SELECT TRIM(postcode) AS postcode,
              COUNT(DISTINCT LOWER(TRIM(scientific_name)))::int AS threatened_species_count
       FROM species_cache
       WHERE (
           LOWER(COALESCE(state_conservation, '')) LIKE '%critical%'
           OR LOWER(COALESCE(state_conservation, '')) LIKE '%endangered%'
           OR LOWER(COALESCE(state_conservation, '')) LIKE '%vulnerable%'
         )
       GROUP BY TRIM(postcode)
     )
     SELECT TRIM(s.postcode) AS postcode,
            d.suburb_name,
            d.lga_name,
            d.population,
            d.household_count,
            s.total_impact_score,
            s.containment_gap_raw,
            s.wildlife_density_raw,
            s.cat_density_raw,
            COALESCE(ts.threatened_species_count, 0)::int AS threatened_species_count
     FROM suburb_scores s
     JOIN suburb_demographics d ON TRIM(d.postcode) = TRIM(s.postcode)
     LEFT JOIN threatened_species ts ON ts.postcode = TRIM(s.postcode)
     WHERE d.state = 'VIC'
       AND s.total_impact_score IS NOT NULL
     ORDER BY s.total_impact_score DESC NULLS LAST,
              d.suburb_name ASC,
              TRIM(s.postcode) ASC
     LIMIT 24`,
    ),
  ])

  const summary = statsResult.rows?.[0] || {}
  const wildlife = threatenedResult.rows?.[0] || {}
  // Convert raw database rows into the exact structure used by the Vue page.
  // No fallback ranking rows are created; if the database has no rows, the API
  // returns an error instead of rendering fake scoreboard entries.
  const rows = (rowsResult.rows || []).map((row, index) => {
    const score = toNum(row.total_impact_score)
    return {
      rank: index + 1,
      suburbName: String(row.suburb_name || '').trim() || String(row.postcode || '').trim(),
      postcode: String(row.postcode || '').trim(),
      lgaName: String(row.lga_name || '').trim(),
      population: toInt(row.population),
      householdCount: toInt(row.household_count),
      score,
      risk: riskLevelForScore(score),
      containmentGapPct: toNum(row.containment_gap_raw),
      wildlifeRecords: toInt(row.wildlife_density_raw),
      roamingCats: toInt(row.cat_density_raw),
      threatenedSpecies: toInt(row.threatened_species_count),
      topPercent: Math.max(1, Math.round(((index + 1) / Math.max(1, toInt(summary.total_regions, 1))) * 100)),
    }
  })

  if (!rows.length) throw new Error('No Victorian suburb score rows found in database')

  return {
    scope: {
      label: 'Victoria',
      source: 'suburb_scores + suburb_demographics',
    },
    summary: {
      totalRegions: toInt(summary.total_regions),
      averageScore: toNum(summary.average_score),
      maxScore: toNum(summary.max_score),
      threatenedRecords: toInt(wildlife.threatened_records),
      threatenedSpecies: toInt(wildlife.threatened_species),
    },
    ranking: rows.slice(0, 6),
    distribution: rows.slice(0, 6),
    criteria: [
      { label: 'Containment Gap', weightPct: 45 },
      { label: 'Wildlife Density', weightPct: 35 },
      { label: 'Roaming Cat Density', weightPct: 20 },
    ],
    formula: {
      note: 'All score values are read from pre-computed database rows in suburb_scores.',
    },
    updatedAt: new Date().toISOString(),
  }
}

// Handle API request and return aggregated Cat's Scoreboard response data.
export default async function handler(req, res) {
  try {
    const data = await getScoreboardData()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load Cat Scoreboard.' })
  }
}
