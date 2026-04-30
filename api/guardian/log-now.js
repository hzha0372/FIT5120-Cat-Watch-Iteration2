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

const toInt = (v, fallback = null) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
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
    if ((req.method || 'POST').toUpperCase() !== 'POST') {
      return res.status(405).json({ error: 'Only POST is supported.' })
    }

    const userId = toInt(req?.body?.userId ?? req?.query?.userId, null)
    if (!userId) {
      return res.status(400).json({ error: 'A valid userId is required.' })
    }

    const db = getPool()
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [userId])
    if (!userCheck.rows?.length) {
      return res.status(404).json({ error: `User ${userId} was not found.` })
    }

    await db.query(
      `INSERT INTO roaming_log (user_id, log_date, status, source, created_at)
       SELECT $1, CURRENT_DATE, 'indoors', 'catwatch_log_now', NOW()
       WHERE NOT EXISTS (
         SELECT 1
         FROM roaming_log
         WHERE user_id = $1
           AND log_date = CURRENT_DATE
           AND LOWER(TRIM(status)) LIKE '%indoor%'
       )`,
      [userId],
    )

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to write roaming_log entry.' })
  }
}
