/* eslint-env node */

const EPIC3_IDENTIFY_URL = 'http://130.162.194.202/api/epic3/identify'

const readJsonLikeResponse = async (response) => {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST is supported.' })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
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
