/* eslint-env node */

// Remote Epic 3 model endpoint documented in EPIC3_FRONTEND_API_GUIDE.md.
// The frontend calls this local proxy instead of calling the remote HTTP URL
// directly, which avoids browser mixed-content/CORS problems after deployment.
const EPIC3_IDENTIFY_URL = 'http://130.162.194.202/api/epic3/identify'

// The upstream server normally returns JSON, but this helper also handles plain
// text errors so the frontend still receives a predictable JSON object.
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
  // Only multipart POST requests are valid because the request must contain the
  // uploaded image file plus postcode/top_k form fields.
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST is supported.' })
    return
  }

  const controller = new AbortController()
  // Requirement: return within 5 seconds. If the model is slow, abort and send
  // a timeout response rather than leaving the user waiting.
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    // Forward the raw request stream and original multipart content-type. This
    // preserves file boundaries so the remote FastAPI service can parse image,
    // postcode, and top_k exactly as if the browser called it directly.
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
