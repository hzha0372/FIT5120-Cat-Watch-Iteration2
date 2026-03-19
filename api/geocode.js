/* eslint-env node */
/* global process */
import dotenv from 'dotenv'

dotenv.config()

const safeFetchJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const text = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON response from geocoding provider.')
  }
}

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const levenshtein = (a, b) => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev = new Array(b.length + 1)
  const curr = new Array(b.length + 1)

  for (let j = 0; j <= b.length; j += 1) prev[j] = j

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
    }

    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]
  }

  return prev[b.length]
}

const dedupeById = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const mapOpenWeatherResults = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => typeof item?.lat === 'number' && typeof item?.lon === 'number')
    .map((item) => {
      const metaParts = [item.state, item.country].filter(Boolean)
      return {
        id: `${item.lat},${item.lon}`,
        name: item.name,
        meta: metaParts.join(', '),
        lat: item.lat,
        lng: item.lon,
      }
    })

const mapOpenMeteoResults = (payload) =>
  (Array.isArray(payload?.results) ? payload.results : [])
    .filter((item) => typeof item?.latitude === 'number' && typeof item?.longitude === 'number')
    .map((item) => {
      const metaParts = [item.admin1, item.country_code || item.country].filter(Boolean)
      return {
        id: `${item.latitude},${item.longitude}`,
        name: item.name,
        meta: metaParts.join(', '),
        lat: item.latitude,
        lng: item.longitude,
      }
    })

const searchOpenWeatherDirect = async ({ q, limit, apiKey }) => {
  if (!apiKey) return []

  const url = new URL('https://api.openweathermap.org/geo/1.0/direct')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('appid', apiKey)

  try {
    const payload = await safeFetchJson(url)
    return mapOpenWeatherResults(payload)
  } catch {
    return []
  }
}

const searchOpenMeteo = async ({ q, limit }) => {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', q)
  url.searchParams.set('count', String(limit))
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  try {
    const payload = await safeFetchJson(url)
    return mapOpenMeteoResults(payload)
  } catch {
    return []
  }
}

const buildRelaxedQuery = (q) => {
  const normalized = normalizeText(q)
  if (!normalized) return ''

  const tokens = normalized.split(' ').filter(Boolean)
  const relaxed = tokens
    .map((token) => {
      if (token.length <= 3) return token
      return token.slice(0, token.length - 1)
    })
    .join(' ')
    .trim()

  if (relaxed && relaxed !== normalized) return relaxed

  // Single-token fallback for typo tolerance (e.g. "Sydn" -> "Syd")
  if (tokens.length === 1 && tokens[0].length > 3) {
    return tokens[0].slice(0, 3)
  }

  return ''
}

const rankByQuery = (items, q) => {
  const normalizedQuery = normalizeText(q)
  if (!normalizedQuery) return items

  return [...items]
    .map((item) => {
      const nameNorm = normalizeText(item.name)
      const metaNorm = normalizeText(item.meta)
      const full = `${nameNorm} ${metaNorm}`.trim()

      let score = 0
      if (nameNorm === normalizedQuery) score += 120
      if (nameNorm.startsWith(normalizedQuery)) score += 90
      if (full.includes(normalizedQuery)) score += 70

      const dist = levenshtein(normalizedQuery, nameNorm)
      const tolerance = Math.max(1, Math.floor(normalizedQuery.length * 0.35))
      if (dist <= tolerance) score += 55 - dist * 10

      if (!nameNorm.includes(' ')) score += 2

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : ''
    const limit = Math.max(1, Math.min(10, Number(limitRaw) || 8))

    if (!q) {
      res.status(400).json({ error: 'Missing q' })
      return
    }

    const isNumeric = /^\d+$/.test(q)

    let results = []

    if (isNumeric) {
      if (!apiKey) {
        res.status(500).json({ error: 'Missing OPENWEATHER_API_KEY' })
        return
      }

      const url = new URL('https://api.openweathermap.org/geo/1.0/zip')
      url.searchParams.set('zip', `${q},AU`)
      url.searchParams.set('appid', apiKey)

      const payload = await safeFetchJson(url)
      if (payload && typeof payload.lat === 'number' && typeof payload.lon === 'number') {
        results = [
          {
            id: `${payload.lat},${payload.lon}`,
            name: payload.name || q,
            meta: `Postcode ${q}, ${payload.country || 'AU'}`,
            lat: payload.lat,
            lng: payload.lon,
          },
        ]
      }
    } else {
      const [openWeatherResults, openMeteoResults] = await Promise.all([
        searchOpenWeatherDirect({ q, limit, apiKey }),
        searchOpenMeteo({ q, limit }),
      ])

      results = dedupeById([...openWeatherResults, ...openMeteoResults])

      const relaxedQuery = buildRelaxedQuery(q)
      if (!results.length && relaxedQuery) {
        const relaxedCandidates = await searchOpenMeteo({
          q: relaxedQuery,
          limit: Math.max(limit * 2, 10),
        })
        results = rankByQuery(relaxedCandidates, q).slice(0, limit)
      } else {
        results = rankByQuery(results, q).slice(0, limit)
      }
    }

    res.status(200).json({ results })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}
