/* eslint-env node */
/* global process, Buffer */
import { Pool } from 'pg'

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'P@ssw0rd',
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

// Local Vite middleware and serverless runtimes can expose request bodies in
// different shapes. This helper supports object, string, and raw stream bodies.
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

// The original schema screenshot did not show a species_sightings table, so the
// API creates it if needed. This keeps the "save confirmed sighting" feature
// self-contained while preserving existing project tables.
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

// If the client did not send precise pin coordinates, use the selected postcode
// centroid from suburb_demographics so the saved sighting can still appear on a map.
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

export default async function handler(req, res) {
  try {
    if (req.method && req.method !== 'POST') {
      res.status(405).json({ error: 'Only POST is supported.' })
      return
    }

    const body = await readJsonBody(req)

    // The frontend sends confirmed species and location context. Names are
    // trimmed before storage to keep database rows clean and searchable.
    const postcode = cleanText(body.postcode)
    const commonName = cleanText(body.commonName)
    const scientificName = cleanText(body.scientificName)
    const source = cleanText(body.source) || 'ai-photo-identifier'
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

    // Prefer explicit lat/lng from the insight API; otherwise fall back to the
    // postcode centroid. Either way the data remains database/location based.
    const lat = toNumOrNull(body.lat) ?? toNumOrNull(location?.centroid_lat)
    const lng = toNumOrNull(body.lng) ?? toNumOrNull(location?.centroid_lng)

    await ensureSightingTable(db)

    // Insert the confirmed sighting and return the normalized row immediately
    // so the Vue page can show "saved as a blue community pin".
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
