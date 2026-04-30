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

const toInt = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Reuse one PostgreSQL connection pool.
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

const monthStartUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

// Resolve the user row used to highlight "you live here".
async function loadResolvedUser(db, userId, postcode) {
  if (userId || postcode) {
    const r = await db.query(
      `SELECT id, TRIM(postcode) AS postcode
       FROM users
       WHERE ($1::int IS NULL OR id = $1::int)
         AND ($2::text IS NULL OR TRIM(postcode) = TRIM($2::text))
       ORDER BY id ASC
       LIMIT 1`,
      [userId || null, postcode || null],
    )
    return r.rows?.[0] || null
  }

  const r = await db.query(
    `SELECT id, TRIM(postcode) AS postcode
     FROM users
     ORDER BY id ASC
     LIMIT 1`,
  )
  return r.rows?.[0] || null
}

// Build the community leaderboard from database rows.
async function getLeaderboardData({ userId = null, postcode = null } = {}) {
  const db = getPool()
  const monthStart = monthStartUtc()
  const user = await loadResolvedUser(db, userId, postcode)
  const userPostcode = String(postcode || user?.postcode || '').trim()

  const hasCommunityTable = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'containment_community_stats'
     ) AS ok`,
  )

  let rows = []

  if (hasCommunityTable.rows?.[0]?.ok) {
    // Prefer precomputed community stats when the table exists.
    const r = await db.query(
      `WITH base AS (
         SELECT TRIM(sd.postcode) AS postcode,
                COALESCE(cs.total_contained_evenings, 0)::int AS total_contained_evenings,
                COALESCE(cs.active_guardian_count, 0)::int AS active_guardian_count,
                COALESCE(cs.encounters_prevented, 0)::numeric AS encounters_prevented,
                CASE WHEN COALESCE(cs.active_guardian_count, 0) > 0
                  THEN (
                    COALESCE(cs.total_contained_evenings, 0)::numeric /
                    (
                      COALESCE(cs.active_guardian_count, 0)::numeric *
                      EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::numeric
                    )
                  )
                  ELSE 0
                END AS containment_rate,
                sd.suburb_name,
                sd.lga_name
         FROM suburb_demographics sd
         LEFT JOIN containment_community_stats cs
           ON TRIM(cs.postcode) = TRIM(sd.postcode)
          AND cs.month_start = $1::date
         WHERE sd.state = 'VIC'
           AND TRIM(COALESCE(sd.postcode, '')) <> ''
       ),
       ranked AS (
         SELECT b.*,
                PERCENT_RANK() OVER (ORDER BY b.containment_rate DESC, b.postcode ASC) AS percentile_rank,
                ROW_NUMBER() OVER (ORDER BY b.containment_rate DESC, b.postcode ASC) AS rank_position,
                COUNT(*) OVER ()::int AS total_regions
         FROM base b
       )
       SELECT *
       FROM ranked
       ORDER BY rank_position ASC`,
      [monthStart],
    )
    rows = r.rows || []
  } else {
    // Fall back to live roaming_log aggregation.
    const r = await db.query(
      `WITH monthly AS (
         SELECT TRIM(u.postcode) AS postcode,
                COUNT(*) FILTER (WHERE LOWER(TRIM(rl.status)) LIKE '%indoor%')::int AS total_contained_evenings,
                COUNT(DISTINCT rl.user_id)::int AS active_guardian_count
         FROM roaming_log rl
         JOIN users u ON u.id = rl.user_id
         WHERE rl.log_date::date >= $1::date
           AND TRIM(COALESCE(u.postcode, '')) <> ''
         GROUP BY TRIM(u.postcode)
       ),
       base AS (
         SELECT TRIM(sd.postcode) AS postcode,
                COALESCE(m.total_contained_evenings, 0)::int AS total_contained_evenings,
                COALESCE(m.active_guardian_count, 0)::int AS active_guardian_count,
                (COALESCE(m.total_contained_evenings, 0)::numeric * 0.0667::numeric) AS encounters_prevented,
                CASE WHEN COALESCE(m.active_guardian_count, 0) > 0
                  THEN (
                    COALESCE(m.total_contained_evenings, 0)::numeric /
                    (
                      COALESCE(m.active_guardian_count, 0)::numeric *
                      EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::numeric
                    )
                  )
                  ELSE 0
                END AS containment_rate,
                sd.suburb_name,
                sd.lga_name
         FROM suburb_demographics sd
         LEFT JOIN monthly m ON m.postcode = TRIM(sd.postcode)
         WHERE sd.state = 'VIC'
           AND TRIM(COALESCE(sd.postcode, '')) <> ''
       ),
       ranked AS (
         SELECT b.*,
                PERCENT_RANK() OVER (ORDER BY b.containment_rate DESC, b.postcode ASC) AS percentile_rank,
                ROW_NUMBER() OVER (ORDER BY b.containment_rate DESC, b.postcode ASC) AS rank_position,
                COUNT(*) OVER ()::int AS total_regions
         FROM base b
       )
       SELECT * FROM ranked ORDER BY rank_position ASC`,
      [monthStart],
    )
    rows = r.rows || []
  }

  // Normalize ranking rows for the frontend.
  const normalized = rows.map((row) => {
    const topPercent = Math.max(1, Math.round((1 - toNum(row.percentile_rank, 0)) * 100))
    const code = String(row.postcode || '').trim()
    return {
      rank: toInt(row.rank_position, 0),
      suburbName: String(row.suburb_name || code).trim(),
      postcode: code,
      containmentRatePct: Number((toNum(row.containment_rate, 0) * 100).toFixed(2)),
      encountersPrevented: Number(toNum(row.encounters_prevented, 0).toFixed(2)),
      topPercent,
      totalRegions: toInt(row.total_regions, 0),
      isUserSuburb: code === userPostcode,
    }
  })

  const topTen = normalized.slice(0, 10)
  const userRow = normalized.find((row) => row.postcode === userPostcode) || null

  return {
    monthStart,
    updatedNote: 'Rankings updated every Monday morning.',
    topTen,
    userRow,
    totalRows: normalized.length,
    percentileLabel: userRow
      ? `${userRow.suburbName} is in the top ${userRow.topPercent}% most active wildlife-protecting communities in Victoria this month.`
      : null,
  }
}

// API entry point for the community leaderboard.
export default async function handler(req, res) {
  try {
    const userId = req?.query?.userId ? toInt(req.query.userId, null) : null
    const postcode = req?.query?.postcode ? String(req.query.postcode).trim() : null
    const payload = await getLeaderboardData({ userId, postcode })
    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load guardian leaderboard.' })
  }
}
