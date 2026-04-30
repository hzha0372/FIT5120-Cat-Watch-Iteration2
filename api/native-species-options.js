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

// Reuse one PostgreSQL pool per Node process.
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

const cleanText = (value) => String(value || '').trim()

export default async function handler(req, res) {
  try {
    // q is optional.
    const q = cleanText(req.query?.q)
    const limit = Math.max(1, Math.min(250, Number(req.query?.limit) || 80))
    const db = getPool()

    // species_cache contains many observation rows per species.
    const result = await db.query(
      `WITH species_rows AS (
         SELECT
           TRIM(vernacular_name) AS vernacular_name,
           TRIM(scientific_name) AS scientific_name,
           COALESCE(NULLIF(TRIM(state_conservation), ''), 'Not listed') AS state_conservation,
           COUNT(*)::int AS sighting_count,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(TRIM(scientific_name))
             ORDER BY COUNT(*) DESC, TRIM(vernacular_name) ASC
           ) AS rn
         FROM species_cache
         WHERE vernacular_name IS NOT NULL
           AND scientific_name IS NOT NULL
           AND TRIM(vernacular_name) <> ''
           AND TRIM(scientific_name) <> ''
           AND (
             $1 = ''
             OR vernacular_name ILIKE $2
             OR scientific_name ILIKE $2
           )
         GROUP BY
           TRIM(vernacular_name),
           TRIM(scientific_name),
           COALESCE(NULLIF(TRIM(state_conservation), ''), 'Not listed')
       )
       SELECT vernacular_name, scientific_name, state_conservation, sighting_count
       FROM species_rows
       WHERE rn = 1
       ORDER BY vernacular_name ASC, scientific_name ASC
       LIMIT $3`,
      [q, `%${q}%`, limit],
    )

    res.status(200).json({
      results: (result.rows || []).map((row) => ({
        id: cleanText(row.scientific_name).toLowerCase(),
        commonName: cleanText(row.vernacular_name),
        scientificName: cleanText(row.scientific_name),
        conservationStatus: cleanText(row.state_conservation) || 'Not listed',
        sightingCount: Number(row.sighting_count || 0),
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load native species.', results: [] })
  }
}
