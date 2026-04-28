<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'

const mapEl = ref(null)
const map = ref(null)
const speciesLayer = ref(null)
const loading = ref(false)
const error = ref('')
const query = ref('')
const suggestions = ref([])
const searchingSuggestions = ref(false)
const selectedSuggestion = ref(null)
const selectedSpecies = ref(null)
const mapData = ref(null)
const activeRiskFilter = ref('red')
let suggestTimer = null

const canSearch = computed(() => String(query.value || '').trim().length > 0)
const visibleSpecies = computed(() => {
  const list = mapData.value?.species || []
  if (activeRiskFilter.value === 'all') return list
  return list.filter((species) => species.riskLevel === activeRiskFilter.value)
})
const riskCounts = computed(() => {
  const list = mapData.value?.species || []
  return {
    high: list.filter((species) => species.riskLevel === 'red').length,
    medium: list.filter((species) => species.riskLevel === 'amber').length,
    low: list.filter((species) => species.riskLevel === 'green').length,
    all: list.length,
  }
})
const threatenedCount = computed(() => mapData.value?.summary?.threatenedSpecies || 0)
const totalSpeciesCount = computed(() => riskCounts.value.all)
const highRiskText = computed(() => `${mapData.value?.summary?.highRiskSpecies || 0} HIGH RISK`)

const statusColor = {
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
}

const legendItems = [
  { key: 'red', label: 'High Risk / Endangered', color: '#ff2d3d' },
  { key: 'amber', label: 'Medium Risk / Vulnerable', color: '#ff6b00' },
  { key: 'green', label: 'Low Risk / Not listed', color: '#16c75a' },
]

// Keep the original suburb/postcode search behavior while using the prototype shell.
const getPostcodeFromInput = (value) => String(value || '').match(/\b(\d{4})\b/)?.[1] || ''

// Normalize /api/suburbs suggestions before display. The API already reads from
// suburb_demographics, but the UI also removes duplicate postcodes defensively
// so partial numeric searches cannot show repeated rows.
const normalizeSuggestionList = (items, rawQuery) => {
  const q = String(rawQuery || '').trim().toLowerCase()
  const list = Array.isArray(items) ? items : []
  const seen = new Set()

  return list
    .filter((item) => {
      const name = String(item?.name || '').toLowerCase()
      const meta = String(item?.meta || '').toLowerCase()
      const postcode = String(item?.postcode || '').toLowerCase()
      return !q || `${name} ${meta} ${postcode}`.includes(q)
    })
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    .filter((item) => {
      const postcode = String(item?.postcode || '').trim()
      if (!postcode || seen.has(postcode)) return false
      seen.add(postcode)
      return true
    })
    .slice(0, 8)
}

const suggestionLabel = (item) => {
  const postcode = String(item?.postcode || '').trim()
  const name = String(item?.name || '').trim()
  if (!postcode) return name
  if (!name || name.toLowerCase() === postcode.toLowerCase()) return postcode
  return item?.label || `${postcode} · ${name}`
}

const suggestionQuery = (item) => {
  const postcode = String(item?.postcode || '').trim()
  const name = String(item?.name || '').trim()
  if (!postcode) return name
  if (!name || name.toLowerCase() === postcode.toLowerCase()) return postcode
  return item?.displayQuery || `${postcode} ${name}`
}

const chooseSuggestion = (item) => {
  query.value = suggestionQuery(item)
  selectedSuggestion.value = item
  suggestions.value = []
  error.value = ''
}

const onInputChange = () => {
  selectedSuggestion.value = null
}

// Leaflet is created only once; all pins are then cleared/re-rendered from the
// latest /api/catwatch payload. The default center is just a Victoria viewport,
// while search results always use database lat/lng from the API response.
const ensureMap = () => {
  if (map.value || !mapEl.value) return

  map.value = L.map(mapEl.value, {
    zoomControl: true,
    preferCanvas: true,
  }).setView([-37.8136, 144.9631], 11)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map.value)

  speciesLayer.value = L.layerGroup().addTo(map.value)
}

const clearSpeciesLayer = () => {
  if (speciesLayer.value) speciesLayer.value.clearLayers()
}

const renderSpecies = async () => {
  await nextTick()
  ensureMap()
  if (!map.value || !speciesLayer.value || !mapData.value) return

  clearSpeciesLayer()
  selectedSpecies.value = null
  const bounds = []

  for (const species of visibleSpecies.value) {
    const lat = Number(species.lat)
    const lng = Number(species.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const marker = L.circleMarker([lat, lng], {
      radius: species.riskLevel === 'red' ? 9 : species.riskLevel === 'amber' ? 8 : 7,
      weight: 2.5,
      color: '#20352b',
      fillColor: statusColor[species.riskLevel] || statusColor.green,
      fillOpacity: 0.95,
      interactive: true,
    })

    marker.on('click', () => {
      selectedSpecies.value = species
    })
    marker.bindTooltip(species.commonName, {
      direction: 'top',
      opacity: 0.95,
      className: 'species-tip',
    })
    marker.addTo(speciesLayer.value)
    bounds.push([lat, lng])
  }

  const homeLat = Number(mapData.value?.location?.lat)
  const homeLng = Number(mapData.value?.location?.lng)
  if (Number.isFinite(homeLat) && Number.isFinite(homeLng)) {
    L.circleMarker([homeLat, homeLng], {
      radius: 9,
      weight: 3,
      color: '#ffffff',
      fillColor: '#111827',
      fillOpacity: 1,
    })
      .bindTooltip('Your home', {
        permanent: true,
        direction: 'bottom',
        className: 'home-label',
        offset: [0, 8],
      })
      .addTo(speciesLayer.value)
    bounds.push([homeLat, homeLng])
  }

  map.value.invalidateSize(true)
  if (bounds.length) map.value.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
}

// The map search resolves a suburb/postcode through /api/suburbs, then asks
// /api/catwatch for species, schedule, risk, and reserve data. If the database
// has no cache rows for a postcode, the error is shown instead of fallback pins.
const loadMapData = async () => {
  loading.value = true
  error.value = ''

  try {
    const postcodeInput = getPostcodeFromInput(query.value)
    let picked = selectedSuggestion.value

    if (!picked && query.value.trim()) {
      const lookupQuery = postcodeInput || query.value
      const resp = await fetch(`/api/suburbs?q=${encodeURIComponent(lookupQuery)}&limit=8`)
      const payload = await resp.json()
      const refined = normalizeSuggestionList(payload?.results, lookupQuery)
      picked = refined[0] || null
      suggestions.value = refined
    }

    let url = ''
    if (picked?.postcode) {
      url =
        `/api/catwatch?postcode=${encodeURIComponent(picked.postcode)}` +
        `&lat=${encodeURIComponent(picked.lat)}` +
        `&lng=${encodeURIComponent(picked.lng)}` +
        `&address=${encodeURIComponent(query.value)}`
      selectedSuggestion.value = picked
    } else if (postcodeInput) {
      url = `/api/catwatch?postcode=${encodeURIComponent(postcodeInput)}&address=${encodeURIComponent(query.value)}`
    } else {
      throw new Error('Please select a Victorian suburb or enter a valid 4-digit postcode.')
    }

    const response = await fetch(url)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load wildlife records.')

    mapData.value = payload
    activeRiskFilter.value = 'red'
    suggestions.value = []
    await renderSpecies()
  } catch (err) {
    error.value = err?.message || 'Unexpected map error.'
  } finally {
    loading.value = false
  }
}

const formatConservation = (name) => {
  const text = String(name || 'Not listed')
  if (text.toLowerCase().includes('critical')) return 'Critically Endangered'
  if (text.toLowerCase().includes('endangered')) return 'Endangered'
  if (text.toLowerCase().includes('vulnerable')) return 'Vulnerable - FFG Act'
  return 'Not listed'
}

const setRiskFilter = (level) => {
  activeRiskFilter.value = level
}

watch(activeRiskFilter, renderSpecies)

watch(query, (value) => {
  const text = String(value || '').trim()
  if (suggestTimer) clearTimeout(suggestTimer)
  if (text.length < 2) {
    suggestions.value = []
    return
  }

  suggestTimer = setTimeout(async () => {
    searchingSuggestions.value = true
    try {
      const resp = await fetch(`/api/suburbs?q=${encodeURIComponent(text)}&limit=8`)
      const payload = await resp.json()
      suggestions.value = normalizeSuggestionList(payload?.results, text)
    } catch {
      suggestions.value = []
    } finally {
      searchingSuggestions.value = false
    }
  }, 220)
})

onUnmounted(() => {
  if (suggestTimer) clearTimeout(suggestTimer)
  clearSpeciesLayer()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<template>
  <main class="map-prototype cw-page">
    <div class="cw-container">
      <header class="map-header">
        <h1 class="cw-page-title">Interactive Risk Map</h1>
        <p class="cw-page-subtitle">
          Explore cat impact risk zones across Victoria and their environmental effects
        </p>
      </header>

      <section class="notice">
        <span>i</span>
        <p>
          Risk levels are calculated based on cat population density, native wildlife
          populations, and ecological sensitivity of the region.
        </p>
      </section>

      <form class="search-panel cw-card" @submit.prevent="loadMapData">
        <label class="search-input-wrap">
          <span>Suburb or Postcode</span>
          <input
            v-model="query"
            type="text"
            autocomplete="off"
            placeholder="Suburb or postcode"
            @input="onInputChange"
          />
          <ul v-if="suggestions.length" class="suggestions">
            <li v-for="item in suggestions" :key="item.id" @click="chooseSuggestion(item)">
              <strong>{{ suggestionLabel(item) }}</strong>
            </li>
          </ul>
          <small v-if="searchingSuggestions" class="suggestion-loading">Searching...</small>
        </label>

        <button type="submit" :disabled="loading || !canSearch">
          {{ loading ? 'Loading...' : 'Search' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <section v-if="mapData" class="summary-strip">
        <div class="summary-left">
          <div class="summary-main">
            <strong>{{ threatenedCount }}</strong>
            <span>threatened species within</span>
            <em>5km</em>
          </div>
          <small>{{ totalSpeciesCount }} native records found</small>
        </div>
        <div class="risk-filter-bar">
          <button
            type="button"
            class="risk-filter-btn high"
            :class="{ active: activeRiskFilter === 'red' }"
            @click="setRiskFilter('red')"
          >
            High Risk ({{ riskCounts.high }})
          </button>
          <button
            type="button"
            class="risk-filter-btn medium"
            :class="{ active: activeRiskFilter === 'amber' }"
            @click="setRiskFilter('amber')"
          >
            Medium Risk ({{ riskCounts.medium }})
          </button>
          <button
            type="button"
            class="risk-filter-btn low"
            :class="{ active: activeRiskFilter === 'green' }"
            @click="setRiskFilter('green')"
          >
            Low Risk ({{ riskCounts.low }})
          </button>
          <button
            type="button"
            class="risk-filter-btn all"
            :class="{ active: activeRiskFilter === 'all' }"
            @click="setRiskFilter('all')"
          >
            All ({{ riskCounts.all }})
          </button>
        </div>
        <span class="risk-pill">{{ highRiskText }}</span>
      </section>

      <section class="map-layout">
        <article class="map-card cw-card">
          <div v-if="!mapData" class="map-placeholder">
            <div class="pin-halo">
              <span>⌖</span>
            </div>
            <h2>Interactive Map View</h2>
            <p>
              Search a Victorian suburb or postcode to display nearby native species,
              risk zones, and cat impact areas.
            </p>
          </div>
          <div v-show="mapData" ref="mapEl" class="leaflet-map" />
        </article>

        <aside class="side-stack">
          <section class="cw-card cw-card-pad">
            <h2 class="side-title">Risk Level Legend</h2>
            <div class="legend-list">
              <div v-for="item in legendItems" :key="item.key">
                <i :style="{ backgroundColor: item.color }" />
                <span>{{ item.label }}</span>
              </div>
            </div>
          </section>

          <section v-if="selectedSpecies" class="cw-card cw-card-pad detail-card">
            <h2 class="side-title">{{ selectedSpecies.commonName }}</h2>
            <p class="scientific">{{ selectedSpecies.scientificName }}</p>
            <dl>
              <div>
                <dt>Conservation status</dt>
                <dd>{{ formatConservation(selectedSpecies.conservationStatus) }}</dd>
              </div>
              <div>
                <dt>Peak activity</dt>
                <dd>{{ selectedSpecies.activityWindowDetail || selectedSpecies.activityWindow }}</dd>
              </div>
              <div>
                <dt>Recorded near you</dt>
                <dd>{{ selectedSpecies.recordedCount3y }} times · past 3 yrs</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>
    </div>
  </main>
</template>

<style scoped>
.map-header {
  margin-bottom: 32px;
}

.notice {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
  border: 1px solid #bfdbfe;
  border-radius: 14px;
  background: #eff6ff;
  color: #1e40af;
  padding: 16px;
}

.notice span {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 2px solid #3b82f6;
  border-radius: 999px;
  color: #2563eb;
  font-size: 0.8rem;
  font-weight: 900;
}

.notice p {
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.5;
}

.search-panel {
  display: grid;
  grid-template-columns: minmax(520px, 1fr) auto;
  gap: 16px;
  align-items: end;
  margin-bottom: 32px;
  padding: 18px;
}

.search-panel label {
  display: grid;
  gap: 10px;
}

.search-panel label > span {
  color: #374151;
  font-size: 0.93rem;
  font-weight: 750;
}

.search-panel input {
  width: 100%;
  height: 50px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  background: #ffffff;
  color: #111827;
  font: inherit;
  font-size: 1rem;
  padding: 0 16px;
}

.search-panel button {
  min-height: 50px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--cw-emerald), var(--cw-teal));
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 850;
  padding: 0 24px;
}

.search-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.search-input-wrap {
  position: relative;
}

.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 1000;
  max-height: 240px;
  overflow: auto;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--cw-shadow);
  list-style: none;
  margin: 0;
  padding: 6px;
}

.suggestions li {
  border-radius: 8px;
  color: #111827;
  cursor: pointer;
  padding: 10px 12px;
}

.suggestions li:hover {
  background: #ecfdf5;
}

.suggestion-loading {
  position: absolute;
  left: 12px;
  top: calc(100% + 8px);
  z-index: 1001;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: var(--cw-muted);
  padding: 3px 10px;
}

.error {
  margin: -12px 0 24px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f2;
  color: #b91c1c;
  padding: 12px 14px;
  font-weight: 750;
}

.summary-strip {
  display: grid;
  grid-template-columns: minmax(350px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  margin-bottom: 32px;
  border-top: 6px solid #143f2b;
  background: #eef1ef;
  padding: 18px 22px;
}

.summary-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.summary-main {
  display: flex;
  align-items: baseline;
  column-gap: 8px;
  row-gap: 2px;
  flex-wrap: wrap;
}

.summary-main strong {
  color: #16372b;
  font-size: 2.8rem;
  line-height: 0.9;
  font-weight: 950;
}

.summary-main span,
.summary-main em {
  color: #6c736e;
  font-size: 1.16rem;
  line-height: 1.35;
  font-style: normal;
}

.summary-left small {
  color: #5d6860;
  font-size: 0.98rem;
  line-height: 1.3;
  font-weight: 850;
}

.risk-filter-bar {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 10px;
  min-width: 0;
}

.risk-filter-btn {
  min-height: 42px;
  border: 2px solid #becac4;
  border-radius: 999px;
  background: transparent;
  color: #47564d;
  cursor: pointer;
  font: inherit;
  font-size: 0.98rem;
  font-weight: 850;
  padding: 0 18px;
  white-space: nowrap;
}

.risk-filter-btn.all {
  border-color: #1f4f37;
  background: #1f4f37;
  color: #ffffff;
}

.risk-filter-btn.active {
  border-color: #9fb1a8;
  background: #f8fbf9;
  color: #20372c;
}

.risk-filter-btn.all.active {
  border-color: #1f4f37;
  background: #1f4f37;
  color: #ffffff;
}

.risk-filter-btn.high.active {
  border-color: #ef8f96;
  background: #fff1f2;
  color: #b53642;
}

.risk-filter-btn.medium.active {
  border-color: #e7be76;
  background: #fff7e6;
  color: #87550c;
}

.risk-filter-btn.low.active {
  border-color: #9fcc90;
  background: #eef9e8;
  color: #3e6d31;
}

.risk-pill {
  justify-self: end;
  flex: 0 0 auto;
  border: 1px solid #ff8793;
  border-radius: 999px;
  background: #fff1f2;
  color: #a73743;
  padding: 9px 24px;
  font-size: 1.08rem;
  font-weight: 950;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 0.95fr);
  gap: 32px;
  align-items: start;
}

.map-card {
  min-height: 600px;
  overflow: hidden;
  display: grid;
}

.map-placeholder {
  max-width: 470px;
  align-self: center;
  justify-self: center;
  padding: 32px;
  text-align: center;
}

.pin-halo {
  width: 128px;
  height: 128px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #bbf7d0;
  color: var(--cw-emerald);
}

.pin-halo span {
  font-size: 4.1rem;
  line-height: 1;
}

.map-placeholder h2 {
  margin: 28px 0 0;
  color: var(--cw-text);
  font-size: 1.65rem;
  line-height: 1.2;
  font-weight: 850;
}

.map-placeholder p {
  margin: 14px 0 0;
  color: var(--cw-muted);
  font-size: 1.08rem;
  line-height: 1.55;
}

.leaflet-map {
  min-height: 600px;
  width: 100%;
}

.side-stack {
  display: grid;
  gap: 24px;
}

.side-title {
  margin: 0;
  color: var(--cw-text);
  font-size: 1.28rem;
  line-height: 1.25;
  font-weight: 850;
}

.legend-list {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.legend-list div {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #374151;
  font-size: 1.05rem;
}

.legend-list i {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 4px;
}

.scientific {
  margin: 8px 0 0;
  color: var(--cw-muted);
  font-style: italic;
}

.detail-card dl {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
}

.detail-card div {
  border-top: 1px solid var(--cw-border);
  padding-top: 12px;
}

.detail-card dt {
  color: var(--cw-soft-muted);
  font-size: 0.9rem;
}

.detail-card dd {
  margin: 4px 0 0;
  color: var(--cw-text);
  font-weight: 800;
}

@media (max-width: 1120px) {
  .search-panel,
  .map-layout {
    grid-template-columns: 1fr;
  }

  .map-card,
  .leaflet-map {
    min-height: 460px;
  }

  .summary-strip {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .risk-filter-bar {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .risk-pill {
    justify-self: start;
  }
}
</style>
