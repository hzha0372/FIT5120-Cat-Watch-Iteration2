export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'Missing OPENWEATHER_API_KEY' })
      return
    }

    const lat = Number(req.query.lat)
    const lon = Number(req.query.lon)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'Missing or invalid lat/lon' })
      return
    }

    const url = new URL('https://api.openweathermap.org/data/3.0/onecall')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lon))
    url.searchParams.set('exclude', 'minutely,daily,alerts')
    url.searchParams.set('appid', apiKey)

    const r = await fetch(url)
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      res.status(r.status).json({ error: `OpenWeather One Call failed (${r.status})`, details: text })
      return
    }

    const data = await r.json()

    const hourlyRaw = Array.isArray(data?.hourly) ? data.hourly : []
    const hourly = hourlyRaw
      .slice(0, 24)
      .map((h) => ({
        time: typeof h?.dt === 'number' ? new Date(h.dt * 1000).toISOString() : null,
        uv: typeof h?.uvi === 'number' ? h.uvi : Number(h?.uvi),
      }))
      .filter((h) => h.time && Number.isFinite(h.uv))

    res.status(200).json({
      timezone: data?.timezone || '',
      currentUv: typeof data?.current?.uvi === 'number' ? data.current.uvi : null,
      hourly,
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}
