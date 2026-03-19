<template>
  <main class="home-shell" aria-label="Home">
    <section class="card enter" aria-labelledby="uv-title">
      <div class="card-head">
        <p class="pill">Realtime UV Safety</p>
        <h1 id="uv-title" class="card-title">Check today’s UV by city or postcode</h1>
        <p class="card-caption">
          Type a city or postcode, then we’ll show today’s peak UV and protection guidance.
        </p>
      </div>

      <form class="search" @submit.prevent="onSearch" aria-label="Search by city or postcode">
        <div class="search-field">
          <label class="sr-only" for="location-input">City or postcode</label>
          <input
            id="location-input"
            v-model.trim="query"
            type="text"
            autocomplete="postal-code"
            placeholder="e.g., 3000 or Melbourne"
            @input="onQueryInput"
            @keydown="onKeydown"
            @blur="onBlur"
            @focus="onFocus"
            aria-autocomplete="list"
            :aria-expanded="showSuggestions ? 'true' : 'false'"
            aria-controls="location-suggestions"
          />
          <ul
            v-if="showSuggestions"
            id="location-suggestions"
            class="suggestions"
            role="listbox"
            aria-label="Location suggestions"
          >
            <li
              v-for="(item, index) in suggestions"
              :key="item.id"
              class="suggestion"
              :class="{ active: index === activeIndex }"
              role="option"
              @mousedown.prevent="selectSuggestion(item)"
            >
              <span class="suggestion-name">{{ item.name }}</span>
              <span class="suggestion-meta">{{ item.meta }}</span>
            </li>
          </ul>
        </div>
        <button class="search-btn" type="submit" :disabled="searching || loading">
          {{ searching ? 'Finding…' : 'Check UV' }}
        </button>
      </form>

      <div class="results">
        <div v-if="location" class="location-chip">
          {{ location.displayName }}
        </div>

        <div class="summary">
          <div class="metric">
            <div class="metric-label">Peak UV today</div>
            <div class="metric-value">{{ uvSummary ? uvSummary.peakUv : '—' }}</div>
            <div v-if="uvSummary" class="metric-sub">
              {{ riskLabel }} risk · {{ uvSummary.peakTime }}
            </div>
          </div>

          <div v-if="uvSummary" class="mini" :class="alertClass" role="status" aria-live="polite">
            <div class="mini-title">{{ alertContent.title }}</div>
            <div class="mini-text">{{ homepageCopy }}</div>
            <div class="mini-text subtle">{{ alertContent.main }}</div>
          </div>
          <div v-else class="placeholder">
            Enter a city or postcode to see today’s UV level and advice.
          </div>

          <p v-if="loading" class="status">Loading hourly UV…</p>
          <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

const loading = ref(false)
const searching = ref(false)
const errorMessage = ref('')
const query = ref('')
const location = ref(null)
const suggestions = ref([])
const showSuggestions = ref(false)
const activeIndex = ref(-1)
let suggestionTimer = null
let suggestionAbort = null

const hourly = ref([])
const parseHourly = (data) => {
  const items = data?.hourly
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Hourly UV data not available for this location.')
  }

  return items
    .map((item) => ({
      time: item?.time ? new Date(item.time) : null,
      uv: typeof item?.uv === 'number' ? item.uv : Number(item?.uv),
    }))
    .filter((d) => d.time instanceof Date && !Number.isNaN(d.time) && Number.isFinite(d.uv))
}

const fetchHourlyUv = async (lat, lng) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) })
    const response = await fetch(`/api/uv?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load hourly UV.')
    }
    hourly.value = parseHourly(data)
    await nextTick()
  } catch (e) {
    hourly.value = []
    errorMessage.value = e?.message || 'Failed to load hourly UV.'
  } finally {
    loading.value = false
  }
}

const formatDisplayName = (name, meta) => {
  const nameText = String(name || '').trim()
  const metaText = String(meta || '').trim()
  const tokens = [nameText, metaText]
    .flatMap((value) => value.split(','))
    .map((part) => part.trim())
    .filter(Boolean)

  if (!tokens.length) return ''

  const seen = new Set()
  const deduped = tokens.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const postcodeIndex = deduped.findIndex((part) => /^\d{4,6}$/.test(part))
  if (postcodeIndex > 0) {
    const [postcode] = deduped.splice(postcodeIndex, 1)
    deduped.unshift(postcode)
  }

  return deduped.join(', ')
}

const fetchLocation = async (searchTerm) => {
  searching.value = true
  errorMessage.value = ''
  location.value = null
  hourly.value = []

  try {
    const trimmed = searchTerm.trim()
    const params = new URLSearchParams({ q: trimmed, limit: '5' })
    const response = await fetch(`/api/geocode?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to find that location.')
    }

    const results = Array.isArray(data?.results) ? data.results : []
    if (!results.length) {
      throw new Error('No matching locations found.')
    }

    const result = results[0]
    location.value = {
      displayName: formatDisplayName(result.name, result.meta),
      lat: result.lat,
      lng: result.lng,
    }
    await fetchHourlyUv(result.lat, result.lng)
  } catch (e) {
    errorMessage.value = e?.message || 'Unable to find that location.'
  } finally {
    searching.value = false
  }
}

const fetchSuggestions = async (searchTerm) => {
  if (suggestionAbort) suggestionAbort.abort()
  suggestionAbort = new AbortController()

  try {
    const trimmed = searchTerm.trim()
    const params = new URLSearchParams({ q: trimmed, limit: '8' })
    const response = await fetch(`/api/geocode?${params.toString()}`, {
      signal: suggestionAbort.signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to find that location.')
    }

    const results = Array.isArray(data?.results) ? data.results : []
    suggestions.value = results.map((item) => ({
      id: item.id,
      name: item.name,
      meta: item.meta,
      lat: item.lat,
      lng: item.lng,
    }))

    showSuggestions.value = suggestions.value.length > 0
    activeIndex.value = -1
  } catch (e) {
    if (e?.name === 'AbortError') return
    suggestions.value = []
    showSuggestions.value = false
  }
}

const onQueryInput = () => {
  const value = query.value.trim()
  errorMessage.value = ''
  if (suggestionTimer) window.clearTimeout(suggestionTimer)
  if (value.length < 2) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  suggestionTimer = window.setTimeout(() => {
    fetchSuggestions(value)
  }, 240)
}

const selectSuggestion = async (item) => {
  query.value = item.name
  suggestions.value = []
  showSuggestions.value = false
  activeIndex.value = -1
  location.value = {
    displayName: formatDisplayName(item.name, item.meta),
    lat: item.lat,
    lng: item.lng,
  }
  await fetchHourlyUv(item.lat, item.lng)
}

const onKeydown = async (event) => {
  if (!showSuggestions.value || !suggestions.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      activeIndex.value <= 0 ? suggestions.value.length - 1 : activeIndex.value - 1
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    await selectSuggestion(suggestions.value[activeIndex.value])
  } else if (event.key === 'Escape') {
    showSuggestions.value = false
  }
}

const onBlur = () => {
  window.setTimeout(() => {
    showSuggestions.value = false
  }, 120)
}

const onFocus = () => {
  if (suggestions.value.length) {
    showSuggestions.value = true
  }
}

const uvSummary = computed(() => {
  if (!hourly.value.length) return null
  const sorted = [...hourly.value].sort((a, b) => a.time.getTime() - b.time.getTime())
  const peak = sorted.reduce((acc, cur) => (cur.uv > acc.uv ? cur : acc), sorted[0])
  const uv3PlusHours = sorted.filter((d) => d.uv >= 3).length
  const peakTime = peak.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return {
    peakUv: peak.uv.toFixed(1),
    peakUvNumber: peak.uv,
    peakTime,
    hoursUv3Plus: uv3PlusHours,
  }
})

const riskLabel = computed(() => {
  const uv = uvSummary.value?.peakUvNumber
  if (!Number.isFinite(uv)) return '—'
  if (uv <= 2.9) return 'Low'
  if (uv <= 5.9) return 'Moderate'
  if (uv <= 7.9) return 'High'
  if (uv <= 10.9) return 'Very High'
  return 'Extreme'
})

const alertContent = computed(() => {
  const uv = uvSummary.value?.peakUvNumber
  if (!Number.isFinite(uv)) {
    return { title: '', main: '', shortTerm: '', longTerm: '' }
  }

  if (uv >= 11) {
    return {
      title: 'Extreme UV: act now',
      main: 'Severe skin damage can occur quickly. Prioritise shade and protection immediately.',
      shortTerm: 'Burning may occur rapidly without protection.',
      longTerm: 'Higher cumulative risk of skin cancer and premature skin aging.',
    }
  }
  if (uv >= 8) {
    return {
      title: 'Very High UV: protect your skin',
      main: 'Plan shade breaks and apply sunscreen to exposed skin.',
      shortTerm: 'Sunburn risk is high during peak hours.',
      longTerm: 'Repeated exposure increases long-term risk of DNA damage.',
    }
  }
  if (uv >= 6) {
    return {
      title: 'High UV: limit exposure',
      main: 'Use sunscreen, protective clothing, and shade—especially around midday.',
      shortTerm: 'Skin can start to burn if unprotected.',
      longTerm: 'Long-term exposure contributes to skin aging and cancer risk.',
    }
  }
  if (uv >= 3) {
    return {
      title: 'Moderate UV: start protection',
      main: 'UV is high enough to cause damage. Prepare before you go outside.',
      shortTerm: 'Unprotected skin can still burn over time.',
      longTerm: 'Cumulative UV exposure adds up across the year.',
    }
  }
  return {
    title: 'Low UV: stay UV-aware',
    main: 'Protection is usually not required unless you will be outside for extended time.',
    shortTerm: 'Low immediate risk.',
    longTerm: 'Continue checking near midday in case UV rises.',
  }
})

const alertClass = computed(() => {
  const uv = uvSummary.value?.peakUvNumber
  if (!Number.isFinite(uv)) return ''
  if (uv <= 2.9) return 'alert--low'
  if (uv <= 5.9) return 'alert--moderate'
  if (uv <= 7.9) return 'alert--high'
  if (uv <= 10.9) return 'alert--veryhigh'
  return 'alert--extreme'
})

const homepageCopy = computed(() => {
  const uv = uvSummary.value?.peakUvNumber
  if (!Number.isFinite(uv)) return ''

  if (uv < 3) {
    return 'UV is usually low right now. Keep UV-aware—levels can rise quickly around midday.'
  }
  if (uv < 6) {
    return 'UV can damage skin even if it doesn’t feel hot. If you’ll be outside, start protection now.'
  }
  if (uv < 8) {
    return 'UV is high. Unprotected skin can burn. Use sunscreen, shade and protective clothing.'
  }
  return 'UV is very high to extreme. Skin damage can occur quickly—avoid peak sun and protect immediately.'
})

const onSearch = async () => {
  const value = query.value.trim()
  if (!value) {
    errorMessage.value = 'Please enter a city or postcode.'
    return
  }

  showSuggestions.value = false
  await fetchLocation(value)
}
</script>

<style scoped>
.home-shell {
  max-width: 1020px;
  margin: 0 auto;
  padding: 26px 22px 40px;
  display: grid;
  gap: 18px;
  color: #0f172a;
}

.card {
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.18), transparent 50%), #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  padding: 20px;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.card-head {
  margin-bottom: 12px;
}

.card-title {
  margin: 0;
  font-size: clamp(1.6rem, 2vw, 2rem);
  letter-spacing: -0.02em;
}

.card-caption {
  margin: 6px 0 0;
  color: rgba(15, 23, 42, 0.65);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(14, 116, 144, 0.12);
  color: #0e7490;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.search {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.search-field input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  font-size: 1rem;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.05);
}

.search-field {
  position: relative;
}

.suggestions {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 10;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
}

.suggestion {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.9);
}

.suggestion.active,
.suggestion:hover {
  background: rgba(14, 116, 144, 0.12);
}

.suggestion-name {
  font-weight: 700;
}

.suggestion-meta {
  color: rgba(15, 23, 42, 0.55);
  font-size: 0.85rem;
}

.search-field input:focus {
  outline: 2px solid rgba(14, 116, 144, 0.35);
  border-color: rgba(14, 116, 144, 0.55);
}

.search-btn {
  padding: 12px 18px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: #fff;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
  box-shadow: 0 10px 18px rgba(14, 116, 144, 0.25);
}

.search-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  box-shadow: none;
}

.search-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(14, 116, 144, 0.3);
}

.results {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.location-chip {
  align-self: start;
  justify-self: start;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: rgba(15, 23, 42, 0.75);
  font-weight: 700;
  font-size: 0.85rem;
}

.metric {
  border-radius: 14px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.02);
}

.metric-label {
  color: rgba(15, 23, 42, 0.6);
  font-weight: 700;
  font-size: 0.9rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 900;
  margin-top: 2px;
}

.metric-sub {
  margin-top: 6px;
  color: rgba(15, 23, 42, 0.65);
  font-size: 0.9rem;
}

.mini {
  margin-top: 12px;
  border-radius: 14px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
}

.mini-title {
  font-weight: 900;
}

.mini-text {
  margin-top: 6px;
  color: rgba(15, 23, 42, 0.82);
  line-height: 1.55;
}

.mini-text.subtle {
  color: rgba(15, 23, 42, 0.7);
  font-size: 0.95rem;
}

.alert--low {
  background: rgba(34, 197, 94, 0.1);
}

.alert--moderate {
  background: rgba(234, 179, 8, 0.12);
}

.alert--high {
  background: rgba(249, 115, 22, 0.12);
}

.alert--veryhigh,
.alert--extreme {
  background: rgba(239, 68, 68, 0.1);
}

.placeholder {
  margin-top: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px dashed rgba(15, 23, 42, 0.25);
  color: rgba(15, 23, 42, 0.7);
  background: rgba(15, 23, 42, 0.02);
}

.status {
  margin: 10px 0 0;
  color: rgba(15, 23, 42, 0.7);
  font-weight: 700;
}

.error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-weight: 800;
}

@media (max-width: 1080px) {
  .search {
    grid-template-columns: 1fr;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.enter {
  animation: enter 420ms ease both;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
