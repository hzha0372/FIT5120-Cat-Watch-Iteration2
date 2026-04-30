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

export default async function handler(req, res) {
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
