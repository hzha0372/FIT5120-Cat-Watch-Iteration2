/* eslint-env node */
/* global process, Buffer */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { Pool } from 'pg'

const DEFAULT_DB_CONFIG = {
  host: '130.162.194.202',
  port: 5432,
  user: 'postgres',
  password: 'P@ssw0rd',
  database: 'echoes_of_earth',
}

const PASSWORD_ITERATIONS = 100000
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_DIGEST = 'sha256'

let pool = null

// Clean form text and normalize email values.
const cleanText = (value) => String(value || '').trim()
const cleanEmail = (value) => cleanText(value).toLowerCase()

// Read JSON bodies from Vite middleware or serverless requests.
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

const getPool = () => {
  if (pool) return pool

  // Connect to PostgreSQL using deployment env vars or the project database.
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

const hashPassword = (password, salt = randomBytes(16).toString('hex')) => {
  // Hash passwords before saving them.
  const hash = pbkdf2Sync(
    String(password),
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  ).toString('hex')

  return { salt, hash }
}

const verifyPassword = (password, salt, expectedHash) => {
  const { hash } = hashPassword(password, salt)
  const actual = Buffer.from(hash, 'hex')
  const expected = Buffer.from(String(expectedHash || ''), 'hex')
  if (actual.length !== expected.length) return false

  // Compare password hashes safely.
  return timingSafeEqual(actual, expected)
}

// Create the credential table linked to the original users table.
const ensureAuthTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS catwatch_auth_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(200) NOT NULL UNIQUE,
      password_hash VARCHAR(128) NOT NULL,
      password_salt VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_catwatch_auth_accounts_user_id
    ON catwatch_auth_accounts (user_id)
  `)
}

const findVictorianPostcode = async (db, postcode) => {
  // Check the postcode exists in suburb_demographics.
  const result = await db.query(
    `SELECT TRIM(postcode) AS postcode, suburb_name
     FROM suburb_demographics
     WHERE state = 'VIC'
       AND TRIM(postcode) = $1
     ORDER BY population DESC NULLS LAST, suburb_name ASC
     LIMIT 1`,
    [postcode],
  )

  return result.rows?.[0] || null
}

const normalizeUserRow = (row) => ({
  // Return only safe profile fields to the frontend.
  id: Number(row.id),
  name: cleanText(row.name),
  email: cleanText(row.email),
  postcode: cleanText(row.postcode),
  suburbName: cleanText(row.suburb_name),
})

const findUserByEmail = async (db, email) => {
  const result = await db.query(
    `SELECT id, name, email, TRIM(postcode) AS postcode
     FROM users
     WHERE LOWER(TRIM(email)) = $1
     ORDER BY id ASC
     LIMIT 1`,
    [email],
  )

  return result.rows?.[0] || null
}

const createUserProfile = async (db, { name, email, postcode }) => {
  const existing = await findUserByEmail(db, email)
  if (existing) return existing

  // Save the user's profile in the original users table.
  const result = await db.query(
    `INSERT INTO users (email, name, postcode, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, name, email, TRIM(postcode) AS postcode`,
    [email, name, postcode],
  )

  return result.rows[0]
}

const attachSuburbName = async (db, user) => {
  const postcode = cleanText(user?.postcode)
  if (!postcode) return { ...user, suburb_name: '' }
  const suburb = await findVictorianPostcode(db, postcode)
  return {
    ...user,
    suburb_name: suburb?.suburb_name || '',
  }
}

const register = async (db, body) => {
  // Validate registration details and create the database account.
  const name = cleanText(body.name)
  const email = cleanEmail(body.email)
  const password = cleanText(body.password)
  const postcode = cleanText(body.postcode)

  if (!name || !email || !password || !postcode) {
    return { status: 400, payload: { error: 'Name, email, password, and postcode are required.' } }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, payload: { error: 'Please enter a valid email address.' } }
  }
  if (!/^\d{4}$/.test(postcode)) {
    return { status: 400, payload: { error: 'Please enter a valid 4-digit Victorian postcode.' } }
  }

  const postcodeRow = await findVictorianPostcode(db, postcode)
  if (!postcodeRow) {
    return { status: 400, payload: { error: 'This postcode was not found in the Victorian suburb database.' } }
  }

  // Prevent duplicate email registrations.
  const existingAuth = await db.query(
    `SELECT id
     FROM catwatch_auth_accounts
     WHERE email = $1
     LIMIT 1`,
    [email],
  )
  if (existingAuth.rows?.length) {
    return { status: 409, payload: { error: 'This email is already registered. Please sign in.' } }
  }

  const user = await createUserProfile(db, { name, email, postcode })
  const { hash, salt } = hashPassword(password)

  // Store password credentials separately from the profile row.
  await db.query(
    `INSERT INTO catwatch_auth_accounts (user_id, email, password_hash, password_salt, updated_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [user.id, email, hash, salt],
  )

  const enrichedUser = await attachSuburbName(db, user)
  return {
    status: 201,
    payload: {
      authenticated: true,
      user: normalizeUserRow(enrichedUser),
    },
  }
}

const login = async (db, body) => {
  // Verify login credentials against the database.
  const email = cleanEmail(body.email || body.username)
  const password = cleanText(body.password)

  if (!email || !password) {
    return { status: 400, payload: { error: 'Email and password are required.' } }
  }

  const result = await db.query(
    // Join credentials to profile data for the returned session.
    `SELECT a.password_hash,
            a.password_salt,
            u.id,
            u.name,
            u.email,
            TRIM(u.postcode) AS postcode
     FROM catwatch_auth_accounts a
     JOIN users u ON u.id = a.user_id
     WHERE a.email = $1
     LIMIT 1`,
    [email],
  )

  const row = result.rows?.[0]
  if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
    return { status: 401, payload: { error: 'Email or password is incorrect.' } }
  }

  const enrichedUser = await attachSuburbName(db, row)
  return {
    status: 200,
    payload: {
      authenticated: true,
      user: normalizeUserRow(enrichedUser),
    },
  }
}

export default async function handler(req, res) {
  try {
    // Route login and register actions through one auth endpoint.
    if ((req.method || 'POST').toUpperCase() !== 'POST') {
      res.status(405).json({ error: 'Only POST is supported.' })
      return
    }

    const body = await readJsonBody(req)
    const action = cleanText(body.action || 'login').toLowerCase()
    const db = getPool()
    await ensureAuthTable(db)

    const result = action === 'register' ? await register(db, body) : await login(db, body)
    res.status(result.status).json(result.payload)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Authentication failed.' })
  }
}
