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

// Clamp value within a specified range.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

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

// Normalize value to 0-100 by min-max range.
const normalize100 = (value, min, max) => {
  const v = toNum(value, 0)
  const lo = toNum(min, 0)
  const hi = toNum(max, 0)
  if (!Number.isFinite(v) || !Number.isFinite(lo) || !Number.isFinite(hi)) return 0
  if (Math.abs(hi - lo) < 1e-9) return v > 0 ? 100 : 0
  return clamp(((v - lo) / (hi - lo)) * 100, 0, 100)
}

// Aggregate weekly user logs into metrics.
const getWeeklyForUser = (rows) => {
  const byDay = new Map()
  for (const row of rows || []) {
    const day = String(row.day || '').trim()
    const status = String(row.status || '')
    if (!day) continue
    if (!byDay.has(day)) byDay.set(day, { roaming: false, indoors: false })
    const item = byDay.get(day)
    if (status.includes('roam')) item.roaming = true
    if (status.includes('indoor')) item.indoors = true
  }

  const allDays = Array.from(byDay.keys()).sort()
  const referenceDay = allDays.length ? allDays[allDays.length - 1] : new Date().toISOString().slice(0, 10)
  const today = new Date(`${referenceDay}T00:00:00`)

  // Generate continuous date keys by offset range.
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

  const roamingEvenings = Array.from(byDay.values()).filter((d) => d.roaming).length
  const containedEvenings = Array.from(byDay.values()).filter((d) => d.indoors).length

  const thisWeekContained = Array.from(byDay.entries()).filter(
    ([day, state]) => thisWeekKeys.has(day) && state.indoors,
  ).length
  const lastWeekContained = Array.from(byDay.entries()).filter(
    ([day, state]) => lastWeekKeys.has(day) && state.indoors,
  ).length

  return {
    allDaysCount: allDays.length,
    roamingEvenings,
    containedEvenings,
    thisWeekContained,
    lastWeekContained,
  }
}

// Query and assemble Cat's Scoreboard data from database tables.
const getScoreboardData = async () => {
  const db = getPool()

  const userResult = await db.query(
    `SELECT id, name, cat_name, cat_age_years, cat_sex, postcode, morning_out, morning_in, evening_out, evening_in
     FROM users
     ORDER BY id ASC
     LIMIT 1`,
  )
  if (!userResult.rows.length) {
    throw new Error('No users found in database')
  }
  const user = userResult.rows[0]
  const postcode = String(user.postcode || '').trim()

  const suburbResult = await db.query(
    `SELECT suburb_name, lga_name, household_count, population
     FROM suburb_demographics
     WHERE TRIM(postcode) = $1
     LIMIT 1`,
    [postcode],
  )
  if (!suburbResult.rows.length) {
    throw new Error(`No suburb_demographics row found for postcode ${postcode}`)
  }
  const suburb = suburbResult.rows[0]
  const lgaName = String(suburb.lga_name || '').trim()

  const homeSpeciesRowsResult = await db.query(
    `SELECT scientific_name, state_conservation, lat, lng
     FROM species_cache
     WHERE TRIM(postcode) = $1`,
    [postcode],
  )
  const homeSpeciesRows = homeSpeciesRowsResult.rows || []
  const seenPinKey = new Set()
  const dedupedSpecies = []
  for (const row of homeSpeciesRows) {
    const lat = Number(row.lat)
    const lng = Number(row.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const speciesKey = String(row.scientific_name || '').trim().toLowerCase()
    const pinKey = `${speciesKey}|${lat.toFixed(5)}|${lng.toFixed(5)}`
    if (seenPinKey.has(pinKey)) continue
    seenPinKey.add(pinKey)
    dedupedSpecies.push(row)
  }
  const dedupThreatenedCount = dedupedSpecies.filter((row) => {
    const conservation = String(row.state_conservation || '').toLowerCase()
    return (
      conservation.includes('critical') ||
      conservation.includes('endangered') ||
      conservation.includes('vulnerable')
    )
  }).length

  const statsResult = await db.query(
    `SELECT stat_name, stat_value, source, notes
     FROM cats_behaviour_stats`,
  )
  const statsMap = new Map()
  for (const row of statsResult.rows || []) {
    statsMap.set(String(row.stat_name || '').trim(), {
      value: Number(row.stat_value),
      source: row.source || '',
      notes: row.notes || '',
    })
  }

  const userLogsResult = await db.query(
    `SELECT TO_CHAR(log_date::date, 'YYYY-MM-DD') AS day, LOWER(TRIM(status)) AS status
     FROM roaming_log
     WHERE user_id = $1
       AND log_date IS NOT NULL`,
    [user.id],
  )

  const weekly = getWeeklyForUser(userLogsResult.rows)
  const preyPerDayStat = Number(statsMap.get('prey_per_day')?.value)
  if (!Number.isFinite(preyPerDayStat) || preyPerDayStat <= 0) {
    throw new Error('Missing or invalid prey_per_day in cats_behaviour_stats')
  }
  const preyMedianMonthlyStat = Number(statsMap.get('prey_median_monthly')?.value)
  const preyRateDaily = preyPerDayStat
  const preyRateMonthly = Number.isFinite(preyMedianMonthlyStat) && preyMedianMonthlyStat > 0
    ? preyMedianMonthlyStat
    : preyRateDaily * 30
  const causedEstimated = Number((weekly.roamingEvenings * preyRateDaily).toFixed(2))
  const preventedEstimated = Number((weekly.containedEvenings * preyRateDaily).toFixed(2))

  const lgaRowsResult = await db.query(
    `WITH lga_suburbs AS (
       SELECT TRIM(postcode) AS postcode,
              suburb_name,
              household_count,
              population
       FROM suburb_demographics
       WHERE lga_name = $1
         AND state = 'VIC'
     ),
     threatened_species AS (
       SELECT TRIM(postcode) AS postcode,
              COUNT(DISTINCT LOWER(TRIM(scientific_name))) AS threatened_species_count
       FROM species_cache
       WHERE TRIM(postcode) IN (SELECT postcode FROM lga_suburbs)
         AND (
           LOWER(COALESCE(state_conservation, '')) LIKE '%critical%'
           OR
           LOWER(COALESCE(state_conservation, '')) LIKE '%endangered%'
           OR LOWER(COALESCE(state_conservation, '')) LIKE '%vulnerable%'
         )
       GROUP BY TRIM(postcode)
     ),
     pet_cats AS (
       SELECT TRIM(postcode) AS postcode,
              COUNT(*)::int AS pet_cat_count
       FROM users
       WHERE TRIM(postcode) IN (SELECT postcode FROM lga_suburbs)
       GROUP BY TRIM(postcode)
     ),
     daily_logs AS (
       SELECT rl.user_id,
              rl.log_date::date AS day,
              BOOL_OR(LOWER(TRIM(rl.status)) LIKE '%indoor%') AS indoors,
              BOOL_OR(LOWER(TRIM(rl.status)) LIKE '%roam%') AS roaming
       FROM roaming_log rl
       WHERE rl.log_date IS NOT NULL
       GROUP BY rl.user_id, rl.log_date::date
     ),
     containment AS (
       SELECT TRIM(u.postcode) AS postcode,
              COUNT(*) FILTER (WHERE dl.indoors OR dl.roaming) AS tracked_days,
              COUNT(*) FILTER (WHERE dl.indoors) AS indoor_days
       FROM daily_logs dl
       JOIN users u ON u.id = dl.user_id
       WHERE TRIM(u.postcode) IN (SELECT postcode FROM lga_suburbs)
       GROUP BY TRIM(u.postcode)
     )
     SELECT s.postcode,
            s.suburb_name,
            s.household_count,
            s.population,
            COALESCE(ts.threatened_species_count, 0)::int AS threatened_species_count,
            COALESCE(pc.pet_cat_count, 0)::int AS pet_cat_count,
            COALESCE(c.tracked_days, 0)::int AS tracked_days,
            COALESCE(c.indoor_days, 0)::int AS indoor_days
     FROM lga_suburbs s
     LEFT JOIN threatened_species ts ON ts.postcode = s.postcode
     LEFT JOIN pet_cats pc ON pc.postcode = s.postcode
     LEFT JOIN containment c ON c.postcode = s.postcode`,
    [lgaName],
  )

  const rawRows = (lgaRowsResult.rows || []).map((row) => {
    const householdCount = toInt(row.household_count, 0)
    const threatenedSpeciesCount = toInt(row.threatened_species_count, 0)
    const petCatCount = toInt(row.pet_cat_count, 0)
    const trackedDays = toInt(row.tracked_days, 0)
    const indoorDays = toInt(row.indoor_days, 0)

    const wildlifeRaw = threatenedSpeciesCount
    const petDensityRaw = householdCount > 0 ? (petCatCount / householdCount) * 100 : 0
    const containmentRate = trackedDays > 0 ? indoorDays / trackedDays : null

    return {
      postcode: String(row.postcode || '').trim(),
      suburbName: String(row.suburb_name || '').trim(),
      householdCount,
      population: toInt(row.population, 0),
      threatenedSpeciesCount,
      petCatCount,
      trackedDays,
      indoorDays,
      wildlifeRaw,
      petDensityRaw,
      containmentRate,
    }
  })

  if (!rawRows.length) {
    throw new Error(`No LGA suburb rows found for ${lgaName}`)
  }

  const knownContainmentRates = rawRows.map((r) => r.containmentRate).filter((n) => Number.isFinite(n))
  const avgContainmentRate = knownContainmentRates.length
    ? knownContainmentRates.reduce((a, b) => a + b, 0) / knownContainmentRates.length
    : 0

  const completedRows = rawRows.map((row) => {
    const containmentRate = Number.isFinite(row.containmentRate) ? row.containmentRate : avgContainmentRate
    return {
      ...row,
      containmentRate,
      containmentGapRaw: (1 - containmentRate) * 100,
    }
  })

  const wildlifeVals = completedRows.map((r) => r.wildlifeRaw)
  const petDensityVals = completedRows.map((r) => r.petDensityRaw)
  const gapVals = completedRows.map((r) => r.containmentGapRaw)

  const wildlifeMin = Math.min(...wildlifeVals)
  const wildlifeMax = Math.max(...wildlifeVals)
  const petDensityMin = Math.min(...petDensityVals)
  const petDensityMax = Math.max(...petDensityVals)
  const gapMin = Math.min(...gapVals)
  const gapMax = Math.max(...gapVals)

  const weights = {
    wildlifeDensity: 0.4,
    petCatDensity: 0.35,
    containmentGap: 0.25,
  }

  const scoredRows = completedRows.map((row) => {
    const wildlifeDensityPct = Math.round(normalize100(row.wildlifeRaw, wildlifeMin, wildlifeMax))
    const petCatDensityPct = Math.round(normalize100(row.petDensityRaw, petDensityMin, petDensityMax))
    const containmentGapPct = Math.round(normalize100(row.containmentGapRaw, gapMin, gapMax))
    const areaScore = Math.round(
      wildlifeDensityPct * weights.wildlifeDensity +
        petCatDensityPct * weights.petCatDensity +
        containmentGapPct * weights.containmentGap,
    )

    return {
      ...row,
      wildlifeDensityPct,
      petCatDensityPct,
      containmentGapPct,
      areaScore: clamp(areaScore, 0, 100),
    }
  })

  const ranked = [...scoredRows].sort((a, b) => {
    if (b.areaScore !== a.areaScore) return b.areaScore - a.areaScore
    return a.suburbName.localeCompare(b.suburbName)
  })

  const totalSuburbs = ranked.length
  const withRank = ranked.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }))

  const current = withRank.find((r) => r.postcode === postcode) || withRank[0]
  const topPercent = Math.max(1, Math.round((current.rank / totalSuburbs) * 100))

  return {
    user: {
      id: user.id,
      name: user.name,
      catName: user.cat_name,
      catAgeYears: toInt(user.cat_age_years, 0),
      catSex: user.cat_sex,
      postcode,
      suburbName: suburb.suburb_name,
      lgaName,
    },
    schedule: {
      morningOut: user.morning_out,
      morningIn: user.morning_in,
      eveningOut: user.evening_out,
      eveningIn: user.evening_in,
    },
    preyRate: {
      monthly: preyRateMonthly,
      daily: Number(preyRateDaily.toFixed(4)),
      note: statsMap.get('prey_per_day')?.notes || 'Derived from cats_behaviour_stats prey_per_day.',
    },
    behaviourStats: {
      outdoorCatPct: statsMap.get('outdoor_cat_pct') || null,
      clandestinePct: statsMap.get('clandestine_pct') || null,
      preyMedianMonthly: statsMap.get('prey_median_monthly') || null,
      preyPerDay: statsMap.get('prey_per_day') || null,
    },
    scoreboard: {
      roamingEvenings: weekly.roamingEvenings,
      containedEvenings: weekly.containedEvenings,
      causedEstimated,
      preventedEstimated,
      gapEstimated: Number((causedEstimated - preventedEstimated).toFixed(2)),
    },
    weekly: {
      thisWeekContained: weekly.thisWeekContained,
      lastWeekContained: weekly.lastWeekContained,
      trend:
        weekly.thisWeekContained > weekly.lastWeekContained
          ? 'up'
          : weekly.thisWeekContained < weekly.lastWeekContained
            ? 'down'
            : 'same',
      hasAtLeastOneWeek: weekly.allDaysCount >= 7,
    },
    localArea: {
      score: current.areaScore,
      rank: current.rank,
      totalSuburbs,
      topPercent,
      headline: `Top ${topPercent}% most at-risk - ${lgaName}`,
      components: {
        wildlifeDensityPct: current.wildlifeDensityPct,
        petCatDensityPct: current.petCatDensityPct,
        containmentGapPct: current.containmentGapPct,
      },
      raw: {
        threatenedSpeciesCount: current.threatenedSpeciesCount,
        threatenedSpeciesCountDedupPoint: dedupThreatenedCount,
        petCatCount: current.petCatCount,
        householdCount: current.householdCount,
        trackedDays: current.trackedDays,
        indoorDays: current.indoorDays,
      },
      ranking: withRank.map((r) => ({
        rank: r.rank,
        suburbName: r.suburbName,
        postcode: r.postcode,
        score: r.areaScore,
        isYou: r.postcode === postcode,
      })),
      formula: {
        note: 'All metrics are computed from real database tables and normalized within the same LGA.',
        weights,
      },
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
