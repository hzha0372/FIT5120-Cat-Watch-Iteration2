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

const getDashboardData = async () => {
  const db = getPool()

  const userResult = await db.query(
    `SELECT id, name, cat_name, postcode
     FROM users
     ORDER BY CASE WHEN LOWER(cat_name) = 'simba' THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
  )
  if (!userResult.rows.length) {
    throw new Error('No users found in database')
  }
  const user = userResult.rows[0]

  const logsResult = await db.query(
    `SELECT TO_CHAR(log_date::date, 'YYYY-MM-DD') AS day, LOWER(TRIM(status)) AS status
     FROM roaming_log
     WHERE user_id = $1
       AND log_date IS NOT NULL`,
    [user.id],
  )

  const byDay = new Map()
  for (const row of logsResult.rows) {
    const day = String(row.day || '').trim()
    const status = String(row.status || '')
    if (!day) continue
    if (!byDay.has(day)) {
      byDay.set(day, { roaming: false, indoors: false })
    }
    const item = byDay.get(day)
    if (status.includes('roam')) item.roaming = true
    if (status.includes('indoor')) item.indoors = true
  }

  const allDays = Array.from(byDay.keys()).sort()
  const roamingEvenings = Array.from(byDay.values()).filter((d) => d.roaming).length
  const containedEvenings = Array.from(byDay.values()).filter((d) => d.indoors).length

  const preyRateMonthly = 2
  const preyRateDaily = preyRateMonthly / 30
  const causedEstimated = Number((roamingEvenings * preyRateDaily).toFixed(2))
  const preventedEstimated = Number((containedEvenings * preyRateDaily).toFixed(2))

  const referenceDay = allDays.length ? allDays[allDays.length - 1] : new Date().toISOString().slice(0, 10)
  const today = new Date(`${referenceDay}T00:00:00`)
  const dayKeys = (startOffset, endOffset) => {
    const keys = []
    for (let offset = startOffset; offset <= endOffset; offset += 1) {
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      keys.push(d.toISOString().slice(0, 10))
    }
    return keys
  }

  const thisWeekKeys = new Set(dayKeys(-6, 0))
  const lastWeekKeys = new Set(dayKeys(-13, -7))

  const thisWeekContained = Array.from(byDay.entries()).filter(
    ([day, state]) => thisWeekKeys.has(day) && state.indoors,
  ).length
  const lastWeekContained = Array.from(byDay.entries()).filter(
    ([day, state]) => lastWeekKeys.has(day) && state.indoors,
  ).length

  return {
    user: {
      id: user.id,
      name: user.name,
      catName: user.cat_name,
      postcode: user.postcode,
    },
    preyRate: {
      monthly: preyRateMonthly,
      daily: Number(preyRateDaily.toFixed(4)),
      note: 'Based on Cat Tracker data- suburban outdoor cats average 2 prey items per month.',
    },
    scoreboard: {
      roamingEvenings,
      containedEvenings,
      causedEstimated,
      preventedEstimated,
      gapEstimated: Number((causedEstimated - preventedEstimated).toFixed(2)),
    },
    weekly: {
      thisWeekContained,
      lastWeekContained,
      trend:
        thisWeekContained > lastWeekContained
          ? 'up'
          : thisWeekContained < lastWeekContained
            ? 'down'
            : 'same',
      hasAtLeastOneWeek: allDays.length >= 7,
    },
    updatedAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  try {
    const data = await getDashboardData()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load impact dashboard.' })
  }
}
