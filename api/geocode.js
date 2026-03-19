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

const inferPlaceKind = (featureCode) => {
  const code = String(featureCode || '').toUpperCase()
  if (!code) return 'unknown'
  if (code === 'PPLC' || code.startsWith('PPLA')) return 'city'
  if (code.startsWith('PPL')) return 'suburb'
  if (code.startsWith('ADM')) return 'suburb'
  return 'unknown'
}

const toPublicResult = (item) => ({
  id: item.id,
  name: item.name,
  meta: item.meta,
  lat: item.lat,
  lng: item.lng,
})

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
        _country: item.country || '',
        _kind: 'unknown',
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
        _country: item.country_code || item.country || '',
        _kind: inferPlaceKind(item.feature_code),
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

const searchOpenWeatherZip = async ({ q, apiKey, countryCode }) => {
  if (!apiKey) return []

  const normalized = String(q || '').trim()
  if (!normalized) return []

  const url = new URL('https://api.openweathermap.org/geo/1.0/zip')
  url.searchParams.set('zip', countryCode ? `${normalized},${countryCode}` : normalized)
  url.searchParams.set('appid', apiKey)

  try {
    const payload = await safeFetchJson(url)
    if (!payload || typeof payload.lat !== 'number' || typeof payload.lon !== 'number') return []
    return [
      {
        id: `${payload.lat},${payload.lon}`,
        name: payload.name || normalized,
        meta: `Postcode ${normalized}, ${payload.country || countryCode || ''}`.replace(/,\s*$/, ''),
        lat: payload.lat,
        lng: payload.lon,
        _country: payload.country || countryCode || '',
        _kind: 'suburb',
      },
    ]
  } catch {
    return []
  }
}

const searchOpenMeteo = async ({ q, limit, countryCode }) => {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', q)
  url.searchParams.set('count', String(limit))
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  if (countryCode) {
    url.searchParams.set('countryCode', countryCode)
  }

  try {
    const payload = await safeFetchJson(url)
    return mapOpenMeteoResults(payload)
  } catch {
    return []
  }
}

const mapMapboxFeatures = (payload, q) =>
  (Array.isArray(payload?.features) ? payload.features : [])
    .filter((feature) => Array.isArray(feature?.center) && feature.center.length >= 2)
    .map((feature) => {
      const context = Array.isArray(feature.context) ? feature.context : []
      const findCtx = (prefix) =>
        context.find((entry) => String(entry?.id || '').startsWith(`${prefix}.`))
      const locality = findCtx('locality')?.text || findCtx('place')?.text
      const countryShort = String(findCtx('country')?.short_code || '')
        .replace(/^country-/, '')
        .toUpperCase()
      const countryText = findCtx('country')?.text || ''
      const country = countryShort || countryText
      const displayName = locality || feature.text || String(q)

      return {
        id: String(feature.id || `${feature.center[1]},${feature.center[0]}`),
        name: displayName,
        meta: String(feature.place_name || '').trim() || [country].filter(Boolean).join(', '),
        lat: Number(feature.center[1]),
        lng: Number(feature.center[0]),
        _country: country || countryText,
        _kind: 'suburb',
      }
    })

const searchMapboxPostcode = async ({ q, limit, token, countryCode }) => {
  if (!token) return []

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(String(q || '').trim())}.json`,
  )
  url.searchParams.set('types', 'postcode,locality,address,place')
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('limit', String(limit))
  if (countryCode) url.searchParams.set('country', countryCode)
  url.searchParams.set('access_token', token)

  try {
    const payload = await safeFetchJson(url)
    return mapMapboxFeatures(payload, q)
  } catch {
    return []
  }
}

const rankNumericByQuery = (items, q) => {
  const normalizedQuery = normalizeText(q)
  if (!normalizedQuery) return items

  return [...items]
    .map((item) => {
      const nameNorm = normalizeText(item.name)
      const metaNorm = normalizeText(item.meta)
      const countryNorm = normalizeText(item._country)
      const isAustralia = countryNorm === 'au' || countryNorm === 'australia'
      const exactPostcodeMatch =
        metaNorm.includes(` ${normalizedQuery} `) ||
        metaNorm.endsWith(` ${normalizedQuery}`) ||
        metaNorm.includes(normalizedQuery)

      let score = 0
      if (exactPostcodeMatch) score += 120
      if (isAustralia && /^\d{4}$/.test(normalizedQuery)) score += 45
      if (item._kind === 'suburb') score += 10
      if (nameNorm && nameNorm !== 'melbourne' && nameNorm !== 'sydney') score += 8
      if (nameNorm === normalizedQuery) score += 5

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
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

const shouldPreferAustralianSuburb = (items, q) => {
  const normalizedQuery = normalizeText(q)
  if (!normalizedQuery) return false

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const isShortKeyword = queryTokens.length <= 2 && normalizedQuery.length >= 3

  const hasCityPrefixMatch = items.some(
    (item) => item?._kind === 'city' && normalizeText(item.name).startsWith(normalizedQuery),
  )
  const hasSuburbPrefixMatch = items.some(
    (item) => item?._kind === 'suburb' && normalizeText(item.name).startsWith(normalizedQuery),
  )
  const exactNameMatches = items.filter((item) => normalizeText(item?.name) === normalizedQuery)
  const hasAustraliaExactMatch = exactNameMatches.some((item) => {
    const countryNorm = normalizeText(item?._country)
    return countryNorm === 'au' || countryNorm === 'australia'
  })

  // Fallback for places often tagged as locality/city (e.g. Clayton):
  // when many identical-name hits exist and one is Australian, treat as suburb-like.
  const looksLikeSuburbKeyword =
    isShortKeyword && exactNameMatches.length >= 3 && hasAustraliaExactMatch

  return (hasSuburbPrefixMatch && !hasCityPrefixMatch) || looksLikeSuburbKeyword
}

const rankByQuery = (items, q, options = {}) => {
  const normalizedQuery = normalizeText(q)
  if (!normalizedQuery) return items
  const preferAustralianSuburb = Boolean(options.preferAustralianSuburb)

  return [...items]
    .map((item) => {
      const nameNorm = normalizeText(item.name)
      const metaNorm = normalizeText(item.meta)
      const full = `${nameNorm} ${metaNorm}`.trim()
      const countryNorm = normalizeText(item._country)
      const isAustralia = countryNorm === 'au' || countryNorm === 'australia'

      let score = 0
      if (nameNorm === normalizedQuery) score += 120
      if (nameNorm.startsWith(normalizedQuery)) score += 90
      if (full.includes(normalizedQuery)) score += 70

      const dist = levenshtein(normalizedQuery, nameNorm)
      const tolerance = Math.max(1, Math.floor(normalizedQuery.length * 0.35))
      if (dist <= tolerance) score += 55 - dist * 10

      if (preferAustralianSuburb && isAustralia) {
        score += 22
        if (item._kind === 'suburb') score += 8
        if (nameNorm === normalizedQuery) score += 10
      }
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
    const mapboxToken = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN

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
      const numericLimit = Math.max(limit, 6)
      const isLikelyAuPostcode = /^\d{4}$/.test(q)
      const [mapboxAu, mapboxGlobal, openWeatherAuZip] = await Promise.all([
        searchMapboxPostcode({
          q,
          limit: numericLimit,
          token: mapboxToken,
          countryCode: isLikelyAuPostcode ? 'au' : undefined,
        }),
        searchMapboxPostcode({ q, limit: numericLimit, token: mapboxToken }),
        searchOpenWeatherZip({ q, apiKey, countryCode: 'AU' }),
      ])

      results = dedupeById([...mapboxAu, ...mapboxGlobal, ...openWeatherAuZip])
      results = rankNumericByQuery(results, q).slice(0, 1)
    } else {
      const auProbeLimit = Math.max(limit, 8)
      const [openWeatherResults, openMeteoResults, openWeatherAuResults, openMeteoAuResults] =
        await Promise.all([
        searchOpenWeatherDirect({ q, limit, apiKey }),
        searchOpenMeteo({ q, limit }),
        searchOpenWeatherDirect({ q: `${q},AU`, limit: auProbeLimit, apiKey }),
        searchOpenMeteo({ q, limit: auProbeLimit, countryCode: 'au' }),
      ])

      results = dedupeById([
        ...openWeatherResults,
        ...openMeteoResults,
        ...openWeatherAuResults,
        ...openMeteoAuResults,
      ])
      const preferAustralianSuburb = shouldPreferAustralianSuburb(results, q)

      const relaxedQuery = buildRelaxedQuery(q)
      if (!results.length && relaxedQuery) {
        const relaxedCandidates = await searchOpenMeteo({
          q: relaxedQuery,
          limit: Math.max(limit * 2, 10),
        })
        const preferForRelaxed = shouldPreferAustralianSuburb(relaxedCandidates, q)
        results = rankByQuery(relaxedCandidates, q, {
          preferAustralianSuburb: preferForRelaxed,
        }).slice(0, limit)
      } else {
        results = rankByQuery(results, q, {
          preferAustralianSuburb,
        }).slice(0, limit)
      }
    }

    res.status(200).json({ results: results.map(toPublicResult) })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}
