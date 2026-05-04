import { Pool } from 'pg'

// Risk Map page JS.
// Owns map data and suburb suggestions used by CatWatchMapView.vue.
// Vercel entry: /api/risk-map, with action=suburbs for the search dropdown.
let riskMapDataHandler
{
/* eslint-env node */
/* global process */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
  database: 'echoes_of_earth',
}

let pool = null

// Safely convert input to integer with fallback.
const toInt = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Parse hour from text and bound it to 0 23.
const parseTimeHour = (value, fallbackHour = null) => {
  if (value === null || value === undefined || value === '') return fallbackHour
  const text = String(value)
  const match = text.match(/^(\d{1,2})/)
  if (!match) return fallbackHour
  const hour = Number(match[1])
  if (!Number.isFinite(hour)) return fallbackHour
  return Math.max(0, Math.min(23, hour))
}

// Map conservation status to risk level color.
const statusToLevel = (status) => {
  const text = String(status || '').toLowerCase()
  if (text.includes('critical') || text.includes('endangered')) return 'red'
  if (text.includes('vulnerable')) return 'amber'
  return 'green'
}

// Infer species type from class and names.
const inferSpeciesType = (className = '', commonName = '', scientificName = '') => {
  const classText = String(className || '').toLowerCase()
  if (classText.includes('aves')) return 'Bird'
  if (classText.includes('reptilia')) return 'Reptile'
  if (classText.includes('mammalia')) return 'Small Mammal'

  const name = `${commonName} ${scientificName}`.toLowerCase()
  if (/(parrot|duck|owl|eagle|hawk|wren|cockatoo|bird)/.test(name)) return 'Bird'
  if (/(snake|lizard|skink|gecko|python|turtle|reptile|frog)/.test(name)) return 'Reptile'
  if (/(possum|bandicoot|fox|rat|mouse|mammal)/.test(name)) return 'Small Mammal'
  return 'Native Species'
}

// Convert 24 hour value to am/pm label.
const formatHourLabel = (hour) => {
  const h = Number(hour)
  if (!Number.isFinite(h)) return ''
  const normalized = ((h % 24) + 24) % 24
  const suffix = normalized >= 12 ? 'pm' : 'am'
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12
  return `${hour12}${suffix}`
}

// Build activity time window display label.
const buildWindowLabel = (startHour, endHour) => `${formatHourLabel(startHour)}-${formatHourLabel(endHour)}`

// Classify hour into dawn/dusk/night windows.
const toActivityWindow = (hour) => {
  const h = Number(hour)
  if (!Number.isFinite(h)) return 'Unknown'
  if (h >= 5 && h <= 9) return 'Dawn'
  if (h >= 16 && h <= 19) return 'Dusk'
  if (h >= 20 || h <= 4) return 'Night'
  return 'All day'
}

// Return detailed description for activity window.
const activityWindowDetail = (window) => {
  if (window === 'Dawn') return 'Dawn · 5am - 9am'
  if (window === 'Dusk') return 'Dusk · 5pm - 7pm'
  if (window === 'Night') return 'Night · 7pm - 5am'
  if (window === 'All day') return 'All day'
  return 'Unknown'
}

// Check whether species activity overlaps cat outing schedule.
const windowOverlaps = (activityWindow, schedule) => {
  const windowText = String(activityWindow || '').toLowerCase()
  const { morningStart, morningEnd, eveningStart, eveningEnd } = schedule

  // Check whether a time range intersects cat morning/evening windows.
  const overlapsRange = (startHour, endHour) => {
    if (startHour <= endHour) {
      const morningOverlap = startHour <= morningEnd && endHour >= morningStart
      const eveningOverlap = startHour <= eveningEnd && endHour >= eveningStart
      return morningOverlap || eveningOverlap
    }
    return overlapsRange(startHour, 23) || overlapsRange(0, endHour)
  }

  if (windowText.includes('dawn')) return overlapsRange(5, 9)
  if (windowText.includes('dusk')) return overlapsRange(17, 19)
  if (windowText.includes('night')) return false
  if (windowText.includes('unknown')) return false
  return overlapsRange(0, 23)
}

// Generate overlap hint between activity window and cat schedule.
const getOverlapWindowLabel = (activityWindow, schedule, overlaps) => {
  if (!overlaps) {
    if (String(activityWindow || '').toLowerCase().includes('night')) return 'Low - nocturnal only'
    if (String(activityWindow || '').toLowerCase().includes('unknown')) return 'Insufficient activity data'
    return 'No overlap'
  }

  const windowText = String(activityWindow || '').toLowerCase()
  if (windowText.includes('dawn')) return `Yes - ${buildWindowLabel(schedule.morningStart, schedule.morningEnd)}`
  if (windowText.includes('dusk')) return `Yes - ${buildWindowLabel(schedule.eveningStart, schedule.eveningEnd)}`
  return `Yes - ${buildWindowLabel(schedule.morningStart, schedule.morningEnd)} and ${buildWindowLabel(schedule.eveningStart, schedule.eveningEnd)}`
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

// Execute DB query and safely return empty on error.
const queryDb = async (sql, params = []) => {
  const db = getPool()
  if (!db) return null
  try {
    return await db.query(sql, params)
  } catch {
    return null
  }
}

// Query centroid location by postcode.
const getPostcodeLocation = async (postcode) => {
  const dbResult = await queryDb(
    `SELECT TRIM(postcode) AS postcode, suburb_name, centroid_lat, centroid_lng
     FROM suburb_demographics
     WHERE TRIM(postcode) = $1
     LIMIT 1`,
    [postcode],
  )

  if (dbResult?.rows?.length) {
    const row = dbResult.rows[0]
    return {
      postcode,
      suburbName: row.suburb_name || 'Unknown suburb',
      lat: Number(row.centroid_lat),
      lng: Number(row.centroid_lng),
    }
  }

  return null
}

// Get cat outing schedule using user data first, aggregate fallback second.
const getSchedule = async (postcode) => {
  const dbResult = await queryDb(
    `SELECT morning_out, morning_in, evening_out, evening_in
     FROM users
     WHERE postcode = $1
       AND morning_out IS NOT NULL
       AND morning_in IS NOT NULL
       AND evening_out IS NOT NULL
       AND evening_in IS NOT NULL
     ORDER BY id ASC
     LIMIT 1`,
    [postcode],
  )

  if (dbResult?.rows?.length) {
    const row = dbResult.rows[0]
    const morningStart = parseTimeHour(row.morning_out)
    const morningEnd = parseTimeHour(row.morning_in)
    const eveningStart = parseTimeHour(row.evening_out)
    const eveningEnd = parseTimeHour(row.evening_in)
    if (![morningStart, morningEnd, eveningStart, eveningEnd].every(Number.isFinite)) return null
    return {
      morningStart,
      morningEnd,
      eveningStart,
      eveningEnd,
      label: `Cat's ${buildWindowLabel(morningStart, morningEnd)} and ${buildWindowLabel(eveningStart, eveningEnd)}`,
      source: 'users-postcode',
    }
  }

  const agg = await queryDb(
    `SELECT
       ROUND(AVG(EXTRACT(HOUR FROM morning_out)))::int AS morning_start,
       ROUND(AVG(EXTRACT(HOUR FROM morning_in)))::int AS morning_end,
       ROUND(AVG(EXTRACT(HOUR FROM evening_out)))::int AS evening_start,
       ROUND(AVG(EXTRACT(HOUR FROM evening_in)))::int AS evening_end
     FROM users
     WHERE morning_out IS NOT NULL
       AND morning_in IS NOT NULL
       AND evening_out IS NOT NULL
       AND evening_in IS NOT NULL`,
    [],
  )

  if (agg?.rows?.length) {
    const row = agg.rows[0]
    const morningStart = parseTimeHour(row.morning_start)
    const morningEnd = parseTimeHour(row.morning_end)
    const eveningStart = parseTimeHour(row.evening_start)
    const eveningEnd = parseTimeHour(row.evening_end)
    if (![morningStart, morningEnd, eveningStart, eveningEnd].every(Number.isFinite)) return null
    return {
      morningStart,
      morningEnd,
      eveningStart,
      eveningEnd,
      label: `Cat's ${buildWindowLabel(morningStart, morningEnd)} and ${buildWindowLabel(eveningStart, eveningEnd)}`,
      source: 'users-aggregate',
    }
  }

  return null
}

// Load nearby species records from DB cache.
const loadSpeciesFromDbCache = async (postcode) => {
  const dbResult = await queryDb(
    `SELECT vernacular_name, scientific_name, state_conservation, lat, lng,
            observation_month, observation_hour
     FROM species_cache
     WHERE TRIM(postcode) = $1`,
    [postcode],
  )

  return dbResult?.rows || []
}

// Load global active hour profiles for species.
const loadGlobalHourProfiles = async (speciesKeys) => {
  const keys = Array.isArray(speciesKeys) ? speciesKeys.filter(Boolean) : []
  if (!keys.length) return new Map()

  const dbResult = await queryDb(
    `SELECT
       LOWER(TRIM(scientific_name)) AS species_key,
       COUNT(*) FILTER (WHERE observation_hour BETWEEN 5 AND 9) AS dawn_count,
       COUNT(*) FILTER (WHERE observation_hour BETWEEN 17 AND 19) AS dusk_count,
       COUNT(*) FILTER (WHERE observation_hour >= 20 OR observation_hour <= 4) AS night_count
     FROM species_cache
     WHERE LOWER(TRIM(scientific_name)) = ANY($1)
     GROUP BY LOWER(TRIM(scientific_name))`,
    [keys],
  )

  const result = new Map()
  for (const row of dbResult?.rows || []) {
    result.set(String(row.species_key || ''), {
      Dawn: toInt(row.dawn_count, 0),
      Dusk: toInt(row.dusk_count, 0),
      Night: toInt(row.night_count, 0),
      'All day': 0,
    })
  }
  return result
}

// Get species list near a target location.
const getSpecies = async ({ postcode }) => {
  if (!postcode) return { rows: [], source: 'none', error: 'Missing postcode for DB query' }
  const cached = await loadSpeciesFromDbCache(postcode)
  if (cached.length) return { rows: cached, source: 'db-cache' }
  return { rows: [], source: 'none', error: `No cached species found for postcode ${postcode}` }
}

// Query nearest reserve to current location.
const getNearestReserve = async ({ lat, lng }) => {
  const dbResult = await queryDb(
    `WITH home AS (
       SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom
     )
     SELECT reserve_name,
            reserve_type,
            ST_AsGeoJSON(boundary) AS geojson,
            ST_Distance(boundary::geography, home.geom::geography) AS distance_m,
            ST_Y(ST_ClosestPoint(boundary, home.geom)) AS closest_lat,
            ST_X(ST_ClosestPoint(boundary, home.geom)) AS closest_lng
     FROM reserves, home
     ORDER BY ST_Distance(boundary::geography, home.geom::geography)
     LIMIT 1`,
    [lng, lat],
  )

  if (dbResult?.rows?.length) {
    const row = dbResult.rows[0]
    return {
      name: row.reserve_name || 'Nearest reserve',
      type: row.reserve_type || 'Protected reserve',
      distanceMeters: Number(row.distance_m),
      geometry: JSON.parse(row.geojson),
      closestPoint:
        Number.isFinite(Number(row.closest_lat)) && Number.isFinite(Number(row.closest_lng))
          ? {
              lat: Number(row.closest_lat),
              lng: Number(row.closest_lng),
            }
          : null,
    }
  }

  return {
    name: 'Nearest reserve',
    type: 'Protected reserve',
    distanceMeters: NaN,
    geometry: null,
    closestPoint: null,
  }
}

// Format meter distance into readable text.
const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return 'Unknown'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// Extract 4 digit postcode from address string.
const extractPostcode = (addressLike) => {
  const match = String(addressLike || '').match(/\b(\d{4})\b/)
  if (!match) return ''
  return match[1]
}

// Handle API request and return aggregated response data.
riskMapDataHandler = async function(req, res) {
  try {
    // Parse location related inputs from query parameters and normalize types.
    const address = typeof req.query.address === 'string' ? req.query.address : ''
    const postcodeInput = typeof req.query.postcode === 'string' ? req.query.postcode.trim() : ''
    const latInput = Number(req.query.lat)
    const lngInput = Number(req.query.lng)
    const hasExplicitCoords = Number.isFinite(latInput) && Number.isFinite(lngInput)
    const postcodeCandidate = postcodeInput || extractPostcode(address)

    let location = null

    // Prefer explicit lat/lng from a selected suburb suggestion, then use the postcode to pull the official suburb name from suburb_demographics.
    if (hasExplicitCoords) {
      const fromDb = /^\d{4}$/.test(postcodeCandidate) ? await getPostcodeLocation(postcodeCandidate) : null
      location = {
        postcode: fromDb?.postcode || postcodeCandidate || '',
        suburbName: fromDb?.suburbName || 'Selected suburb',
        lat: latInput,
        lng: lngInput,
      }
    } else if (/^\d{4}$/.test(postcodeCandidate)) {
      location = await getPostcodeLocation(postcodeCandidate)
    }

    if (!location) {
      res.status(400).json({ error: 'Please enter a valid Victorian suburb or postcode.' })
      return
    }

    const schedule = await getSchedule(location.postcode || '')
    if (!schedule) {
      res.status(503).json({
        error: 'No cat roaming schedule found in database users table. Please load users data first.',
        location,
      })
      return
    }
    const speciesResult = await getSpecies({ postcode: location.postcode || '' })
    const rawSpecies = speciesResult.rows || []

    if (!rawSpecies.length) {
      res.status(503).json({
        error:
          'No wildlife cache data found in your database for this postcode. Please load species_cache first.',
        location,
        source: speciesResult.source || 'none',
      })
      return
    }

    // Build per species activity statistics from local cached observations.
    const speciesFrequency = new Map()
    const speciesHourProfile = new Map()
    const speciesHourSet = new Map()
    for (const row of rawSpecies) {
      const key = String(row.scientific_name || '').trim().toLowerCase()
      if (!key) continue
      speciesFrequency.set(key, (speciesFrequency.get(key) || 0) + 1)

      if (row.observation_hour === null || row.observation_hour === undefined) continue
      const h = Number(row.observation_hour)
      if (!Number.isFinite(h) || h < 0 || h > 23) continue
      const bucket = toActivityWindow(h)
      if (!speciesHourProfile.has(key)) {
        speciesHourProfile.set(key, { Dawn: 0, Dusk: 0, Night: 0, 'All day': 0 })
      }
      if (!speciesHourSet.has(key)) speciesHourSet.set(key, new Set())
      speciesHourSet.get(key).add(h)
      speciesHourProfile.get(key)[bucket] += 1
    }

    const fallbackSpeciesKeys = []
    for (const key of speciesFrequency.keys()) {
      const hours = speciesHourSet.get(key)
      if (!hours || !hours.size || (hours.size === 1 && hours.has(0))) fallbackSpeciesKeys.push(key)
    }
    const globalProfiles = await loadGlobalHourProfiles(fallbackSpeciesKeys)

    // De duplicate map pins so the same species at the same point appears once.
    const dedupedRows = []
    const seenPinKey = new Set()
    for (const row of rawSpecies) {
      const lat = Number(row.lat)
      const lng = Number(row.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const speciesKey = String(row.scientific_name || '').trim().toLowerCase()
      const pinKey = `${speciesKey}|${lat.toFixed(5)}|${lng.toFixed(5)}`
      if (seenPinKey.has(pinKey)) continue
      seenPinKey.add(pinKey)
      dedupedRows.push(row)
    }

    // Transform DB rows into API friendly species objects used by the frontend map.
    const species = dedupedRows.map((item, idx) => {
      const speciesKey = String(item.scientific_name || '').trim().toLowerCase()
      const localProfile = speciesHourProfile.get(speciesKey)
      const localHours = speciesHourSet.get(speciesKey)
      const useGlobalProfile =
        !localHours || !localHours.size || (localHours.size === 1 && localHours.has(0))
      const profile = useGlobalProfile ? globalProfiles.get(speciesKey) || localProfile : localProfile
      const speciesType = inferSpeciesType(item.classs, item.vernacular_name, item.scientific_name)
      let activityWindow = 'Unknown'
      if (profile) {
        const ranked = Object.entries(profile).sort((a, b) => b[1] - a[1])
        if ((ranked[0]?.[1] || 0) > 0) activityWindow = ranked[0][0]
      }
      const conservation = item.state_conservation || 'Not listed'
      const riskLevel = statusToLevel(conservation)
      const overlaps = windowOverlaps(activityWindow, schedule)
      const recordedCount = speciesFrequency.get(speciesKey) || 1

      return {
        id: `${item.scientific_name || 'species'}-${idx}`,
        commonName: item.vernacular_name || 'Unknown species',
        scientificName: item.scientific_name || 'Unknown species',
        conservationStatus: conservation,
        speciesType,
        riskLevel,
        lat: Number(item.lat),
        lng: Number(item.lng),
        activityWindow,
        activityWindowDetail: activityWindowDetail(activityWindow),
        overlapWithCat: overlaps,
        overlapWindow: getOverlapWindowLabel(activityWindow, schedule, overlaps),
        recordedCount3y: recordedCount,
      }
    })

    const threatenedCount = species.filter((s) => s.riskLevel !== 'green').length
    const highRiskCount = species.filter((s) => s.riskLevel === 'red').length
    const reserve = await getNearestReserve({ lat: location.lat, lng: location.lng })

    // Return complete payload for the map, side panel details, and summary badges.
    res.status(200).json({
      location,
      schedule,
      summary: {
        totalSpecies: rawSpecies.length,
        threatenedSpecies: threatenedCount,
        highRiskSpecies: highRiskCount,
      },
      source: speciesResult.source,
      species,
      nearestReserve: {
        ...reserve,
        distanceLabel: formatDistance(reserve.distanceMeters),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load Cat Watch map data.' })
  }
}

}

let riskMapSuburbsHandler
{
/* eslint-env node */
/* global process */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
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
riskMapSuburbsHandler = async function(req, res) {
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
    // Search only Victorian suburb_demographics rows.
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
           WHEN suburb_name ILIKE $4 AND LOWER(TRIM(suburb_name)) <> LOWER(TRIM(postcode)) THEN 0
           ELSE 1
         END,
         CASE
           WHEN LOWER(TRIM(suburb_name)) = LOWER(TRIM(postcode)) THEN 1
           ELSE 0
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
      // Some source rows use the postcode as the suburb name.
      const hasRealName = name.toLowerCase() !== postcode.toLowerCase()
      const label = isPostcode && hasRealName ? `${postcode} · ${name}` : hasRealName ? name : postcode
      const displayQuery = hasRealName ? `${postcode} ${name}` : postcode
      if (!dedup.has(postcode)) {
        dedup.set(postcode, {
          id: `${postcode}-${name}`,
          name,
          postcode,
          lat: Number(row.centroid_lat),
          lng: Number(row.centroid_lng),
          label,
          displayQuery,
        })
      }
    }

    res.status(200).json({ results: Array.from(dedup.values()).slice(0, limit) })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Suburb lookup failed', results: [] })
  }
}

}

export default async function riskMapHandler(req, res) {
  const action = String(req.query?.action || req.featureAction || 'data')
  if (action === 'suburbs') return riskMapSuburbsHandler(req, res)
  return riskMapDataHandler(req, res)
}
