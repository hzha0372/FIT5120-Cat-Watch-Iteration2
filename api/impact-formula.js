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
// The weight values are the CatWatch formula definition used to calculate
// suburb_scores; the endpoint also reads the database so the UI can show this
// block only when real scoring rows and source tables are available.
export default async function handler(req, res) {
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
