export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'Missing OPENWEATHER_API_KEY' })
      return
    }

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
      const url = new URL('https://api.openweathermap.org/geo/1.0/zip')
      url.searchParams.set('zip', `${q},AU`)
      url.searchParams.set('appid', apiKey)

      const r = await fetch(url)
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        res.status(r.status).json({ error: `OpenWeather geocoding failed (${r.status})`, details: text })
        return
      }

      const data = await r.json()
      if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
        results = [
          {
            id: `${data.lat},${data.lon}`,
            name: data.name || q,
            meta: `Postcode ${q}, ${data.country || 'AU'}`,
            lat: data.lat,
            lng: data.lon,
          },
        ]
      }
    } else {
      const url = new URL('https://api.openweathermap.org/geo/1.0/direct')
      url.searchParams.set('q', q)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('appid', apiKey)

      const r = await fetch(url)
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        res.status(r.status).json({ error: `OpenWeather geocoding failed (${r.status})`, details: text })
        return
      }

      const data = await r.json()
      results = (Array.isArray(data) ? data : [])
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
    }

    res.status(200).json({ results })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}
