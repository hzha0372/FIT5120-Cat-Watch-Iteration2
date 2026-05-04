import { Pool } from 'pg'

// Photo Identifier page JS.
// Owns photo identification, species options, suburb lookup, sighting insights, confirmed reports, and predation stats.
// Vercel entry: /api/photo-identifier, with action values for supporting sections.
let photoIdentifierModelHandler
{
/* eslint-env node */

// Remote Epic 3 model endpoint documented in EPIC3_FRONTEND_API_GUIDE.md.
const EPIC3_IDENTIFY_URL = 'http://130.162.194.202/api/epic3/identify'

// The upstream server normally returns JSON, but this helper also handles plain text errors so the frontend still receives a predictable JSON object.
const readJsonLikeResponse = async (response) => {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

photoIdentifierModelHandler = async function(req, res) {
  // Only multipart POST requests are valid because the request must contain the uploaded image file plus postcode/top_k form fields.
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST is supported.' })
    return
  }

  const controller = new AbortController()
  // Requirement: return within 5 seconds.
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    // Forward the raw request stream and original multipart content type.
    const response = await fetch(EPIC3_IDENTIFY_URL, {
      method: 'POST',
      headers: {
        'content-type': req.headers?.['content-type'] || '',
      },
      body: req,
      duplex: 'half',
      signal: controller.signal,
    })
    const payload = await readJsonLikeResponse(response)
    res.status(response.status).json(payload)
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Identification took longer than 5 seconds.'
        : error?.message || 'Species identification failed.'
    res.status(error?.name === 'AbortError' ? 504 : 502).json({ error: message })
  } finally {
    clearTimeout(timeout)
  }
}

}

let photoIdentifierSuburbsHandler
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
photoIdentifierSuburbsHandler = async function(req, res) {
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

let photoIdentifierSpeciesOptionsHandler
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

photoIdentifierSpeciesOptionsHandler = async function(req, res) {
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

}

let photoIdentifierInsightsHandler
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

// Shared connection pool.
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
const toInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const toNumOrNull = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const isoOrNull = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Look up the user's selected Victorian postcode.
const getLocation = async (db, postcode) => {
  const result = await db.query(
    `SELECT TRIM(postcode) AS postcode,
            suburb_name,
            lga_name,
            centroid_lat,
            centroid_lng
     FROM suburb_demographics
     WHERE state = 'VIC'
       AND TRIM(postcode) = $1
     ORDER BY population DESC NULLS LAST, suburb_name ASC
     LIMIT 1`,
    [postcode],
  )

  return result.rows?.[0] || null
}

// Find the species row in species_cache.
const getSpeciesMatch = async (db, scientificName, commonName) => {
  const result = await db.query(
    `SELECT
       TRIM(vernacular_name) AS vernacular_name,
       TRIM(scientific_name) AS scientific_name,
       COALESCE(NULLIF(TRIM(state_conservation), ''), 'Not listed') AS state_conservation,
       COUNT(*)::int AS sighting_count
     FROM species_cache
     WHERE (
       ($1 <> '' AND LOWER(TRIM(scientific_name)) = LOWER($1))
       OR ($2 <> '' AND LOWER(TRIM(vernacular_name)) = LOWER($2))
     )
       AND vernacular_name IS NOT NULL
       AND scientific_name IS NOT NULL
     GROUP BY
       TRIM(vernacular_name),
       TRIM(scientific_name),
       COALESCE(NULLIF(TRIM(state_conservation), ''), 'Not listed')
     ORDER BY
       CASE WHEN LOWER(TRIM(scientific_name)) = LOWER($1) THEN 0 ELSE 1 END,
       sighting_count DESC
     LIMIT 1`,
    [scientificName, commonName],
  )

  return result.rows?.[0] || null
}

photoIdentifierInsightsHandler = async function(req, res) {
  try {
    const postcode = cleanText(req.query?.postcode)
    const scientificName = cleanText(req.query?.scientificName)
    const commonName = cleanText(req.query?.commonName)

    if (!/^\d{4}$/.test(postcode)) {
      res.status(400).json({ error: 'Please enter a valid 4-digit Victorian postcode.' })
      return
    }

    if (!scientificName && !commonName) {
      res.status(400).json({ error: 'Please provide a species name.' })
      return
    }

    const db = getPool()
    const [location, matchedSpecies] = await Promise.all([
      getLocation(db, postcode),
      getSpeciesMatch(db, scientificName, commonName),
    ])

    if (!location) {
      res.status(404).json({ error: `No Victorian suburb found for postcode ${postcode}.` })
      return
    }

    if (!matchedSpecies) {
      res.status(404).json({ error: 'No matching species was found in species_cache.' })
      return
    }

    const speciesKey = cleanText(matchedSpecies.scientific_name).toLowerCase()
    const lgaName = cleanText(location.lga_name)

    const homeLat = toNumOrNull(location.centroid_lat)
    const homeLng = toNumOrNull(location.centroid_lng)

    // Run independent aggregation queries in parallel: localResult: observations within 5km of the postcode centroid.
    const [localResult, lgaResult, victoriaResult, pinsResult] = await Promise.all([
      db.query(
        // PostGIS ST_DWithin calculates the 5km radius on geography coordinates, which is more accurate than comparing raw lat/lng degrees.
        `WITH home AS (
           SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geom
         )
         SELECT COUNT(*)::int AS count, MAX(cached_at) AS latest_cached_at
         FROM species_cache sc, home
         WHERE LOWER(TRIM(sc.scientific_name)) = $3
           AND sc.lat IS NOT NULL
           AND sc.lng IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(sc.lng::float, sc.lat::float), 4326)::geography,
             home.geom,
             5000
           )`,
        [homeLng, homeLat, speciesKey],
      ),
      db.query(
        // LGA count joins species_cache postcodes to suburb_demographics so the result follows the selected postcode's local government area.
        `WITH lga_postcodes AS (
           SELECT DISTINCT TRIM(postcode) AS postcode
           FROM suburb_demographics
           WHERE state = 'VIC'
             AND lga_name = $1
         )
         SELECT COUNT(*)::int AS count
         FROM species_cache sc
         JOIN lga_postcodes lp ON TRIM(sc.postcode) = lp.postcode
         WHERE LOWER(TRIM(sc.scientific_name)) = $2`,
        [lgaName, speciesKey],
      ),
      db.query(
        // Victoria wide total is a simple species count across all cached rows.
        `SELECT COUNT(*)::int AS count, MAX(cached_at) AS latest_cached_at
         FROM species_cache
         WHERE LOWER(TRIM(scientific_name)) = $1`,
        [speciesKey],
      ),
      db.query(
        // Local pins are grouped by coordinate so repeated observations at the same point become one marker with a count.
        `WITH home AS (
           SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geom
         )
         SELECT sc.lat, sc.lng, COUNT(*)::int AS count
         FROM species_cache sc, home
         WHERE LOWER(TRIM(sc.scientific_name)) = $3
           AND sc.lat IS NOT NULL
           AND sc.lng IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(sc.lng::float, sc.lat::float), 4326)::geography,
             home.geom,
             5000
           )
         GROUP BY sc.lat, sc.lng
         ORDER BY count DESC
         LIMIT 12`,
        [homeLng, homeLat, speciesKey],
      ),
    ])

    res.status(200).json({
      prediction: {
        common_name: cleanText(matchedSpecies.vernacular_name),
        scientific_name: cleanText(matchedSpecies.scientific_name),
      },
      conservation_status: cleanText(matchedSpecies.state_conservation) || 'Not listed',
      local_sighting_count: toInt(localResult.rows?.[0]?.count),
      lga_sighting_count: toInt(lgaResult.rows?.[0]?.count),
      victoria_sighting_count: toInt(victoriaResult.rows?.[0]?.count),
      latest_local_cached_at: isoOrNull(localResult.rows?.[0]?.latest_cached_at),
      latest_victoria_cached_at: isoOrNull(victoriaResult.rows?.[0]?.latest_cached_at),
      suburb_name: cleanText(location.suburb_name),
      lga_name: lgaName,
      location: {
        postcode: cleanText(location.postcode),
        lat: homeLat,
        lng: homeLng,
      },
      local_pins: (pinsResult.rows || []).map((row) => ({
        lat: toNumOrNull(row.lat),
        lng: toNumOrNull(row.lng),
        count: toInt(row.count),
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to load species insight.' })
  }
}

}

let photoIdentifierReportsHandler
{
/* eslint-env node */
/* global process, Buffer */

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'bbd4ba1eb45b2b5308e993832030699301d9dc49b2b935d747759502bc8e055a',
  database: 'echoes_of_earth',
}

let pool = null

// Reuse a database connection pool for saving confirmed sightings.
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
const toNumOrNull = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Local Vite middleware and serverless runtimes can expose request bodies in different shapes.
const readJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

// The original schema screenshot did not show a species_sightings table, so the API creates it if needed.
const ensureSightingTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS species_sightings (
      id SERIAL PRIMARY KEY,
      postcode BPCHAR(4) NOT NULL,
      vernacular_name VARCHAR(200) NOT NULL,
      scientific_name VARCHAR(200) NOT NULL,
      confidence NUMERIC(5, 2),
      lat NUMERIC(9, 6),
      lng NUMERIC(9, 6),
      source VARCHAR(50),
      photo_filename VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_species_sightings_postcode
    ON species_sightings (postcode)
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_species_sightings_scientific_name
    ON species_sightings (LOWER(TRIM(scientific_name)))
  `)
}

// If the client did not send precise pin coordinates, use the selected postcode centroid from suburb_demographics so the saved sighting can...
const getPostcodeLocation = async (db, postcode) => {
  const result = await db.query(
    `SELECT centroid_lat, centroid_lng
     FROM suburb_demographics
     WHERE state = 'VIC'
       AND TRIM(postcode) = $1
     ORDER BY population DESC NULLS LAST, suburb_name ASC
     LIMIT 1`,
    [postcode],
  )

  return result.rows?.[0] || null
}

photoIdentifierReportsHandler = async function(req, res) {
  try {
    if (req.method && req.method !== 'POST') {
      res.status(405).json({ error: 'Only POST is supported.' })
      return
    }

    const body = await readJsonBody(req)

    // The frontend sends confirmed species and location context.
    const postcode = cleanText(body.postcode)
    const commonName = cleanText(body.commonName)
    const scientificName = cleanText(body.scientificName)
    const source = cleanText(body.source) || 'photo-identifier'
    const photoFilename = cleanText(body.photoFilename)
    const confidence = toNumOrNull(body.confidence)

    if (!/^\d{4}$/.test(postcode)) {
      res.status(400).json({ error: 'A valid 4-digit Victorian postcode is required.' })
      return
    }

    if (!commonName || !scientificName) {
      res.status(400).json({ error: 'A confirmed species name is required.' })
      return
    }

    const db = getPool()
    const location = await getPostcodeLocation(db, postcode)

    // Prefer explicit lat/lng from the insight API; otherwise fall back to the postcode centroid.
    const lat = toNumOrNull(body.lat) ?? toNumOrNull(location?.centroid_lat)
    const lng = toNumOrNull(body.lng) ?? toNumOrNull(location?.centroid_lng)

    await ensureSightingTable(db)

    // Insert the confirmed sighting and return the normalized row immediately so the Vue page can show "saved as a blue community pin".
    const result = await db.query(
      `INSERT INTO species_sightings
         (postcode, vernacular_name, scientific_name, confidence, lat, lng, source, photo_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         id,
         TRIM(postcode) AS postcode,
         vernacular_name,
         scientific_name,
         confidence,
         lat,
         lng,
         source,
         photo_filename,
         created_at`,
      [postcode, commonName, scientificName, confidence, lat, lng, source, photoFilename || null],
    )

    const row = result.rows[0]
    res.status(201).json({
      sighting: {
        id: row.id,
        postcode: cleanText(row.postcode),
        commonName: cleanText(row.vernacular_name),
        scientificName: cleanText(row.scientific_name),
        confidence: toNumOrNull(row.confidence),
        lat: toNumOrNull(row.lat),
        lng: toNumOrNull(row.lng),
        source: cleanText(row.source),
        photoFilename: cleanText(row.photo_filename),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to save confirmed sighting.' })
  }
}

}

let photoIdentifierPredationStatsHandler
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

// Return mission statistics needed by the Photo Identifier predation warning.
photoIdentifierPredationStatsHandler = async function(req, res) {
  try {
    const db = getPool()

    // Each query maps one UI metric to one source table: cats_behaviour_stats supplies research backed behaviour percentages.
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

}

export default async function photoIdentifierHandler(req, res) {
  const action = String(req.query?.action || req.featureAction || 'identify')
  if (action === 'suburbs') return photoIdentifierSuburbsHandler(req, res)
  if (action === 'species-options') return photoIdentifierSpeciesOptionsHandler(req, res)
  if (action === 'insights') return photoIdentifierInsightsHandler(req, res)
  if (action === 'reports') return photoIdentifierReportsHandler(req, res)
  if (action === 'predation-stats') return photoIdentifierPredationStatsHandler(req, res)
  return photoIdentifierModelHandler(req, res)
}
