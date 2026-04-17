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
export default async function handler(req, res) {
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
           WHEN suburb_name ILIKE $4 THEN 0
           ELSE 1
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
      if (!dedup.has(postcode)) {
        dedup.set(postcode, {
          id: `${postcode}-${name}`,
          name,
          postcode,
          lat: Number(row.centroid_lat),
          lng: Number(row.centroid_lng),
          label: isPostcode ? `${postcode} · ${name}` : name,
          displayQuery: isPostcode ? `${postcode} ${name}` : name,
        })
      }
    }

    res.status(200).json({ results: Array.from(dedup.values()).slice(0, limit) })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Suburb lookup failed', results: [] })
  }
}
