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

const PREY_RATE_FALLBACK = 0.0667

let pool = null

const toInt = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

const toNum = (v, fallback = 0) => {
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

const monthStartUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

const toIsoDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const diffDays = (laterIso, earlierIso) => {
  const later = new Date(`${laterIso}T00:00:00Z`).getTime()
  const earlier = new Date(`${earlierIso}T00:00:00Z`).getTime()
  return Math.round((later - earlier) / 86400000)
}

const getMilestones = (streakDays) => {
  const defs = [
    { days: 3, icon: 'seedling', label: '3 days' },
    { days: 7, icon: 'star', label: '7 days' },
    { days: 14, icon: 'medal', label: '14 days' },
    { days: 30, icon: 'trophy', label: '30 days' },
    { days: 60, icon: 'diamond', label: '60 days' },
  ]

  return defs.map((item) => ({
    ...item,
    unlocked: streakDays >= item.days,
  }))
}

const getScoreboardData = async (options = {}) => {
  const db = getPool()
  const monthStart = monthStartUtc()

  const preyRateResult = await db.query(
    `SELECT stat_value
     FROM cats_behaviour_stats
     WHERE stat_name = 'prey_per_day'
     LIMIT 1`,
  )
  const preyPerDay = toNum(preyRateResult.rows?.[0]?.stat_value, PREY_RATE_FALLBACK)

  const resolvedUser =
    options.userId || options.postcode
      ? (
          await db.query(
            `SELECT id, name, cat_name, TRIM(postcode) AS postcode
             FROM users
             WHERE ($1::int IS NULL OR id = $1::int)
               AND ($2::text IS NULL OR TRIM(postcode) = TRIM($2::text))
             ORDER BY id ASC
             LIMIT 1`,
            [options.userId || null, options.postcode || null],
          )
        ).rows?.[0]
      : (
          await db.query(
            `SELECT id, name, cat_name, TRIM(postcode) AS postcode
             FROM users
             ORDER BY id ASC
             LIMIT 1`,
          )
        ).rows?.[0]

  if (!resolvedUser?.id) {
    throw new Error('No user row found to calculate Cat Scoreboard metrics.')
  }

  const todayIsoResult = await db.query(`SELECT CURRENT_DATE::text AS today_iso`)
  const todayIso = todayIsoResult.rows?.[0]?.today_iso

  const [userIndoorDaysResult, userMonthResult, suburbResult] = await Promise.all([
    db.query(
      `SELECT DISTINCT rl.log_date::date AS day
       FROM roaming_log rl
       WHERE rl.user_id = $1
         AND LOWER(TRIM(rl.status)) LIKE '%indoor%'
       ORDER BY day DESC`,
      [resolvedUser.id],
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE LOWER(TRIM(status)) LIKE '%indoor%')::int AS indoor_count,
              COUNT(*) FILTER (WHERE LOWER(TRIM(status)) LIKE '%roam%')::int AS roaming_count
       FROM roaming_log
       WHERE user_id = $1
         AND log_date::date >= $2::date`,
      [resolvedUser.id, monthStart],
    ),
    db.query(
      `SELECT suburb_name, lga_name
       FROM suburb_demographics
       WHERE TRIM(postcode) = $1
       LIMIT 1`,
      [String(resolvedUser.postcode || '').trim()],
    ),
  ])

  const indoorDays = (userIndoorDaysResult.rows || []).map((r) => toIsoDate(r.day)).filter(Boolean)
  let currentStreak = 0
  let streakBroken = false

  if (indoorDays.length > 0 && indoorDays[0] === todayIso) {
    currentStreak = 1
    for (let i = 1; i < indoorDays.length; i += 1) {
      if (diffDays(indoorDays[i - 1], indoorDays[i]) === 1) {
        currentStreak += 1
      } else {
        break
      }
    }
  } else if (indoorDays.length > 0) {
    streakBroken = true
  }

  let bestStreak = 0
  let run = 0
  for (let i = indoorDays.length - 1; i >= 0; i -= 1) {
    if (i === indoorDays.length - 1) {
      run = 1
      bestStreak = 1
      continue
    }
    if (diffDays(indoorDays[i + 1], indoorDays[i]) === 1) {
      run += 1
    } else {
      run = 1
    }
    bestStreak = Math.max(bestStreak, run)
  }

  const userMonth = userMonthResult.rows?.[0] || {}
  const userContainedMonth = toInt(userMonth.indoor_count, 0)
  const userRoamingMonth = toInt(userMonth.roaming_count, 0)

  const userPostcode = String(resolvedUser.postcode || '').trim()
  const suburbMeta = suburbResult.rows?.[0] || {}

  const leaderboardResult = await db.query(
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
     enriched AS (
       SELECT TRIM(sd.postcode) AS postcode,
              sd.suburb_name,
              sd.lga_name,
              COALESCE(m.total_contained_evenings, 0)::int AS total_contained_evenings,
              COALESCE(m.active_guardian_count, 0)::int AS active_guardian_count,
              CASE
                WHEN COALESCE(m.active_guardian_count, 0) > 0
                THEN (
                  COALESCE(m.total_contained_evenings, 0)::numeric /
                  (
                    COALESCE(m.active_guardian_count, 0)::numeric *
                    EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::numeric
                  )
                )
                ELSE 0
              END AS containment_rate,
              (COALESCE(m.total_contained_evenings, 0)::numeric * $2::numeric) AS encounters_prevented
       FROM suburb_demographics sd
       LEFT JOIN monthly m ON m.postcode = TRIM(sd.postcode)
       WHERE sd.state = 'VIC'
         AND TRIM(COALESCE(sd.postcode, '')) <> ''
     ),
     ranked AS (
       SELECT e.*,
              PERCENT_RANK() OVER (ORDER BY e.containment_rate DESC, e.postcode ASC) AS percentile_rank,
              ROW_NUMBER() OVER (ORDER BY e.containment_rate DESC, e.postcode ASC) AS rank_position,
              COUNT(*) OVER ()::int AS total_regions
       FROM enriched e
     )
     SELECT *
     FROM ranked
     ORDER BY rank_position ASC`,
    [monthStart, preyPerDay],
  )

  const allRankedRows = leaderboardResult.rows || []
  const topTen = allRankedRows.slice(0, 10)
  const userRow = allRankedRows.find((row) => String(row.postcode || '').trim() === userPostcode) || null

  const ranking = [...topTen]
  if (userRow && !topTen.some((r) => String(r.postcode || '').trim() === userPostcode)) {
    ranking.push(userRow)
  }

  let rankingRows = ranking.map((row) => {
    const ratePct = Number((toNum(row.containment_rate, 0) * 100).toFixed(2))
    const percentileTop = Math.max(1, Math.round((1 - toNum(row.percentile_rank, 0)) * 100))
    const isUserSuburb = String(row.postcode || '').trim() === userPostcode
    return {
      rank: toInt(row.rank_position),
      suburbName: String(row.suburb_name || row.postcode || '').trim(),
      postcode: String(row.postcode || '').trim(),
      lgaName: String(row.lga_name || '').trim(),
      activeGuardianCount: toInt(row.active_guardian_count, 0),
      hasLowSample: toInt(row.active_guardian_count, 0) < 3,
      containedEvenings: toInt(row.total_contained_evenings, 0),
      containmentRatePct: ratePct,
      encountersPrevented: Number(toNum(row.encounters_prevented, 0).toFixed(2)),
      topPercent: percentileTop,
      isUserSuburb,
    }
  })

  // Keep leaderboard strictly formula-based from guardian containment data only.

  const communityBase = userRow ||
    (
      await db.query(
        `WITH monthly AS (
           SELECT TRIM(u.postcode) AS postcode,
                  COUNT(*) FILTER (WHERE LOWER(TRIM(rl.status)) LIKE '%indoor%')::int AS total_contained_evenings,
                  COUNT(DISTINCT rl.user_id)::int AS active_guardian_count
           FROM roaming_log rl
           JOIN users u ON u.id = rl.user_id
           WHERE rl.log_date::date >= $1::date
             AND TRIM(COALESCE(u.postcode, '')) <> ''
           GROUP BY TRIM(u.postcode)
         )
         SELECT m.postcode,
                sd.suburb_name,
                sd.lga_name,
                m.total_contained_evenings,
                m.active_guardian_count
         FROM monthly m
         LEFT JOIN suburb_demographics sd ON TRIM(sd.postcode) = m.postcode
         WHERE m.postcode = $2
         LIMIT 1`,
        [monthStart, userPostcode],
      )
    ).rows?.[0]

  const communityContained = toInt(communityBase?.total_contained_evenings, 0)
  const communityActive = toInt(communityBase?.active_guardian_count, 0)
  const communityEncounter = Number((communityContained * preyPerDay).toFixed(2))
  const userEncounter = Number((userContainedMonth * preyPerDay).toFixed(2))

  const summaryResult = await db.query(
    `SELECT COUNT(*)::int AS participating_regions,
            COALESCE(SUM(total_contained_evenings), 0)::int AS total_contained_evenings,
            COALESCE(SUM(active_guardian_count), 0)::int AS active_guardians
     FROM (
       SELECT TRIM(u.postcode) AS postcode,
              COUNT(*) FILTER (WHERE LOWER(TRIM(rl.status)) LIKE '%indoor%')::int AS total_contained_evenings,
              COUNT(DISTINCT rl.user_id)::int AS active_guardian_count
       FROM roaming_log rl
       JOIN users u ON u.id = rl.user_id
       WHERE rl.log_date::date >= $1::date
         AND TRIM(COALESCE(u.postcode, '')) <> ''
       GROUP BY TRIM(u.postcode)
     ) s`,
    [monthStart],
  )

  const summary = summaryResult.rows?.[0] || {}

  return {
    scope: {
      label: 'Victoria',
      source: 'roaming_log + users + suburb_demographics + cats_behaviour_stats',
    },
    summary: {
      participatingRegions: toInt(summary.participating_regions, 0),
      totalContainedEvenings: toInt(summary.total_contained_evenings, 0),
      activeGuardians: toInt(summary.active_guardians, 0),
      preyRatePerDay: preyPerDay,
    },
    personal: {
      userId: toInt(resolvedUser.id),
      userName: String(resolvedUser.name || '').trim() || 'Cat owner',
      catName: String(resolvedUser.cat_name || '').trim() || 'Cat',
      currentStreak,
      bestStreak,
      containedThisMonth: userContainedMonth,
      roamingThisMonth: userRoamingMonth,
      encountersPrevented: Number((currentStreak * preyPerDay).toFixed(2)),
      milestones: getMilestones(currentStreak),
      streakBroken,
      hasAnyIndoorLog: indoorDays.length > 0,
      lastIndoorLogDate: indoorDays[0] || null,
    },
    guardian: {
      suburbName: String(communityBase?.suburb_name || suburbMeta.suburb_name || userPostcode).trim(),
      postcode: userPostcode,
      lgaName: String(communityBase?.lga_name || suburbMeta.lga_name || '').trim(),
      totalContainedEvenings: communityContained,
      activeGuardianCount: communityActive,
      encountersPrevented: communityEncounter,
      userContributionEvenings: userContainedMonth,
      userContributionEncounters: userEncounter,
      isFirstGuardian: communityActive <= 1,
      userTopPercent: userRow ? Math.max(1, Math.round((1 - toNum(userRow.percentile_rank, 0)) * 100)) : null,
      userRankPosition: userRow ? toInt(userRow.rank_position) : null,
      rankedRegionCount: userRow ? toInt(userRow.total_regions) : toInt(allRankedRows.length, 0),
    },
    ranking: rankingRows,
    distribution: rankingRows,
    criteria: [
      { label: 'Containment Rate', weightPct: 100 },
    ],
    leaderboardMeta: {
      threshold: 3,
      monthStart,
      updatedNote: 'Rankings updated every Monday morning.',
    },
    updatedAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  try {
    const userId = req?.query?.userId ? toInt(req.query.userId, null) : null
    const postcode = req?.query?.postcode ? String(req.query.postcode).trim() : null
    const data = await getScoreboardData({ userId, postcode })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load Cat Scoreboard.' })
  }
}
