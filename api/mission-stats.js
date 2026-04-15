/* eslint-env node */
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
  return Number.isFinite(n) ? n : fallback
}

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

export default async function handler(req, res) {
  try {
    const db = getPool()

    const [statsResult, usersResult, reservesResult, speciesResult, logsResult] = await Promise.all([
      db.query(`SELECT stat_name, stat_value, source, notes FROM cats_behaviour_stats`),
      db.query(`SELECT COUNT(*)::int AS user_count FROM users`),
      db.query(`SELECT COUNT(*)::int AS reserve_count FROM reserves`),
      db.query(`SELECT COUNT(DISTINCT LOWER(TRIM(scientific_name)))::int AS species_count FROM species_cache`),
      db.query(`SELECT COUNT(*)::int AS log_count FROM roaming_log`),
    ])

    const statsMap = new Map()
    for (const row of statsResult.rows || []) {
      statsMap.set(String(row.stat_name || '').trim(), {
        value: Number(row.stat_value),
        source: row.source || '',
        notes: row.notes || '',
      })
    }

    res.status(200).json({
      behaviourStats: {
        outdoorCatPct: statsMap.get('outdoor_cat_pct') || null,
        clandestinePct: statsMap.get('clandestine_pct') || null,
        preyMedianMonthly: statsMap.get('prey_median_monthly') || null,
        preyPerDay: statsMap.get('prey_per_day') || null,
      },
      coverage: {
        usersTracked: toInt(usersResult.rows?.[0]?.user_count, 0),
        reservesMapped: toInt(reservesResult.rows?.[0]?.reserve_count, 0),
        speciesCached: toInt(speciesResult.rows?.[0]?.species_count, 0),
        roamingLogs: toInt(logsResult.rows?.[0]?.log_count, 0),
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load mission stats.' })
  }
}
