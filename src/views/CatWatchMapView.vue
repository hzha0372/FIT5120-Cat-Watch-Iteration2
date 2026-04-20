<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'

const mapEl = ref(null)
const map = ref(null)
const speciesLayer = ref(null)
const reserveLayer = ref(null)
const loading = ref(false)
const error = ref('')

const query = ref('')
const selectedSpecies = ref(null)
const mapData = ref(null)
const showReserves = ref(false)
const viewMode = ref('entry')

const suggestions = ref([])
const searchingSuggestions = ref(false)
const selectedSuggestion = ref(null)
let suggestTimer = null
const canSearch = computed(() => String(query.value || '').trim().length > 0)
const radiusBadgeText = computed(() => {
  const suburb =
    mapData.value?.location?.suburbName || selectedSuggestion.value?.name || 'Victoria'
  return `${suburb} · 5km`
})

const statusColor = {
  red: '#e65252',
  amber: '#f0ab2f',
  green: '#6a9d31',
}

const legendItems = [
  { key: 'red', label: 'Endangered' },
  { key: 'amber', label: 'Vulnerable' },
  { key: 'green', label: 'Not listed' },
]
const activeRiskFilter = ref('red')
const filteredSpeciesList = computed(() => {
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

const summaryText = computed(() => {
  if (!mapData.value?.summary) return '0 threatened species within 5km'
  const count = mapData.value.summary.threatenedSpecies
  return `${count} threatened species within 5km`
})

const threatenedCount = computed(() => mapData.value?.summary?.threatenedSpecies || 0)
const totalSpeciesCount = computed(() => riskCounts.value.all)

const highRiskText = computed(() => {
  const n = mapData.value?.summary?.highRiskSpecies || 0
  return `${n} HIGH RISK`
})

const reserveBanner = computed(() => {
  if (!showReserves.value || !mapData.value?.nearestReserve) return null
  return mapData.value.nearestReserve
})

// Format conservation status display text.
const formatConservation = (name) => {
  const text = String(name || 'Not listed')
  if (text.toLowerCase().includes('critical')) return 'Critically Endangered'
  if (text.toLowerCase().includes('endangered')) return 'Endangered'
  if (text.toLowerCase().includes('vulnerable')) return 'Vulnerable - FFG Act'
  return 'Not listed'
}

const overlapSummaryText = computed(() => {
  if (!selectedSpecies.value) return ''
  if (selectedSpecies.value.overlapWithSimba) return selectedSpecies.value.overlapWindow || 'Yes'
  return selectedSpecies.value.overlapWindow || 'No overlap'
})

const isHighRiskSpecies = computed(() => {
  if (!selectedSpecies.value) return false
  return selectedSpecies.value.riskLevel === 'red' && selectedSpecies.value.overlapWithSimba
})

const riskPanelTitle = computed(() => {
  if (!isHighRiskSpecies.value) return ''
  return `HIGH RISK - overlaps with Simba's roaming hours`
})

const riskPanelBody = computed(() => {
  if (!selectedSpecies.value) return ''
  if (isHighRiskSpecies.value) {
    return `${selectedSpecies.value.commonName} is active at ${selectedSpecies.value.activityWindow.toLowerCase()} (${selectedSpecies.value.overlapWindow.replace('Yes - ', '')}). This overlaps directly with Simba's saved roaming window.`
  }
  if (selectedSpecies.value.riskLevel === 'amber' && selectedSpecies.value.overlapWithSimba) {
    return `${selectedSpecies.value.commonName} overlaps with Simba's roaming hours (${selectedSpecies.value.overlapWindow.replace('Yes - ', '')}). This species is Vulnerable, so reduce outdoor roaming during that period.`
  }
  if (selectedSpecies.value.overlapWithSimba) {
    return `${selectedSpecies.value.commonName} overlaps with Simba's roaming hours (${selectedSpecies.value.overlapWindow.replace('Yes - ', '')}). Keep monitoring local sightings.`
  }
  if (String(selectedSpecies.value.activityWindow || '').toLowerCase() === 'unknown') {
    return `No reliable activity-hour records are available for this species at this location yet. Continue monitoring nearby sightings and keep roaming windows conservative.`
  }
  return `This species is active mainly at ${selectedSpecies.value.activityWindow.toLowerCase()}. Simba's 7-9am and 5-7pm windows have minimal overlap with its activity period.`
})

// Extract postcode from input text.
const getPostcodeFromInput = (value) => {
  const match = String(value || '').match(/\b(\d{4})\b/)
  return match?.[1] || ''
}

// Initialize map instance and bind tile layer.
const ensureMap = () => {
  if (map.value || !mapEl.value) return

  map.value = L.map(mapEl.value, {
    zoomControl: true,
    preferCanvas: true,
  }).setView([-37.9057, 144.6628], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map.value)

  speciesLayer.value = L.layerGroup().addTo(map.value)
  reserveLayer.value = L.layerGroup().addTo(map.value)
}

// Wait for map container render before continuing.
const waitForMapElement = async (retries = 12, delayMs = 60) => {
  for (let i = 0; i < retries; i += 1) {
    await nextTick()
    if (mapEl.value) return true
    // out-in transition leaves/enters asynchronously
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return Boolean(mapEl.value)
}

// Ensure map is ready, then trigger rendering.
const ensureMapAndRender = async () => {
  const ready = await waitForMapElement()
  if (!ready) return
  ensureMap()
  if (!map.value || !mapEl.value) return
  map.value.invalidateSize(true)
  renderSpecies()
  renderReserve()
}

// Compute centroid coordinates from geometry.
const getGeometryCentroid = (geometry) => {
  const coords = []
  // Recursively collect coordinate points from geometry.
  const collect = (value) => {
    if (!Array.isArray(value)) return
    if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      coords.push([value[0], value[1]])
      return
    }
    value.forEach(collect)
  }
  collect(geometry?.coordinates)
  if (!coords.length) return null
  const [sumLng, sumLat] = coords.reduce(
    (acc, pair) => [acc[0] + Number(pair[0]), acc[1] + Number(pair[1])],
    [0, 0],
  )
  return [sumLat / coords.length, sumLng / coords.length]
}

// Clear species and reserve layers on the map.
const clearLayers = () => {
  if (speciesLayer.value) speciesLayer.value.clearLayers()
  if (reserveLayer.value) reserveLayer.value.clearLayers()
}

// Switch risk filter and sync current selection.
const setRiskFilter = (level) => {
  activeRiskFilter.value = level
  if (selectedSpecies.value && level !== 'all' && selectedSpecies.value.riskLevel !== level) {
    selectedSpecies.value = null
  }
  renderSpecies()
}

// Generate stable pseudo-random value from text for point spreading.
const seededUnit = (text) => {
  const s = String(text || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

// Build display points and handle overlap.
const buildDisplayPoints = (speciesList) => {
  if (!map.value) return speciesList.map((s) => ({ species: s, lat: Number(s.lat), lng: Number(s.lng) }))

  // Group points by rounded coordinates so only truly overlapping pins are spread.
  const groups = new Map()
  for (const species of speciesList) {
    const key = `${Number(species.lat).toFixed(5)}|${Number(species.lng).toFixed(5)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(species)
  }

  const points = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      points.push({
        species: group[0],
        lat: Number(group[0].lat),
        lng: Number(group[0].lng),
      })
      continue
    }

    const centerLat = Number(group[0].lat)
    const centerLng = Number(group[0].lng)
    const center = map.value.latLngToLayerPoint([centerLat, centerLng])
    const nodes = group.map((species, idx) => {
      const base = `${species.id || species.scientificName || species.commonName || 'sp'}-${idx}`
      const a = seededUnit(`${base}-a`) * Math.PI * 2
      const r = 3 + seededUnit(`${base}-r`) * 7
      return {
        species,
        x: center.x + Math.cos(a) * r,
        y: center.y + Math.sin(a) * r,
      }
    })

    // Run a short physics-style relaxation so markers keep a minimum spacing.
    const minDist = 13
    const maxRadius = 24
    for (let iter = 0; iter < 18; iter += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const d = Math.hypot(dx, dy) || 0.0001
          if (d >= minDist) continue
          const push = (minDist - d) * 0.35
          const ux = dx / d
          const uy = dy / d
          nodes[i].x -= ux * push
          nodes[i].y -= uy * push
          nodes[j].x += ux * push
          nodes[j].y += uy * push
        }
      }

      // Keep all shifted points within a fixed radius around the original location.
      for (const n of nodes) {
        const ox = n.x - center.x
        const oy = n.y - center.y
        const od = Math.hypot(ox, oy) || 0.0001
        if (od > maxRadius) {
          const scale = maxRadius / od
          n.x = center.x + ox * scale
          n.y = center.y + oy * scale
        }
      }
    }

    for (const n of nodes) {
      const latLng = map.value.layerPointToLatLng(L.point(n.x, n.y))
      points.push({
        species: n.species,
        lat: latLng.lat,
        lng: latLng.lng,
      })
    }
  }
  return points
}

// Render species markers and interaction popups.
const renderSpecies = () => {
  if (!map.value || !speciesLayer.value || !mapData.value) return

  const bounds = []
  speciesLayer.value.clearLayers()

  // Pre-calculate map-safe display coordinates before creating markers.
  const displayPoints = buildDisplayPoints(filteredSpeciesList.value)

  for (const point of displayPoints) {
    const { species } = point
    // Update selected species for right-panel detail linkage.
    const setSelected = () => {
      selectedSpecies.value = species
    }

    const hitArea = L.circleMarker([point.lat, point.lng], {
      radius: 14,
      weight: 0,
      color: 'transparent',
      fillColor: 'transparent',
      fillOpacity: 0,
      interactive: true,
      bubblingMouseEvents: false,
    })
    hitArea.on('click', setSelected)
    hitArea.on('touchstart', setSelected)
    hitArea.addTo(speciesLayer.value)

    // Draw the visible marker after the larger transparent hit area.
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: species.riskLevel === 'red' ? 9 : species.riskLevel === 'amber' ? 8 : 7,
      weight: 2.5,
      color: '#20352b',
      fillColor: statusColor[species.riskLevel] || statusColor.green,
      fillOpacity: 0.95,
      interactive: true,
      bubblingMouseEvents: false,
    })
    marker.on('click', setSelected)
    marker.on('touchstart', setSelected)
    marker.bindTooltip(species.commonName, {
      direction: 'top',
      opacity: 0.95,
      className: 'species-tip',
    })

    marker.addTo(speciesLayer.value)
    marker.bringToFront()
    bounds.push([point.lat, point.lng])
  }

  // Keep the user home marker in the same layer so all points fit one bounds call.
  const homeLat = Number(mapData.value?.location?.lat)
  const homeLng = Number(mapData.value?.location?.lng)
  if (Number.isFinite(homeLat) && Number.isFinite(homeLng)) {
    const homeMarker = L.circleMarker([homeLat, homeLng], {
      radius: 9,
      weight: 3,
      color: '#f7f8f7',
      fillColor: '#1e3e2f',
      fillOpacity: 1,
    })
    homeMarker.bindTooltip('Your home', {
      permanent: true,
      direction: 'bottom',
      className: 'home-label',
      offset: [0, 8],
    })
    homeMarker.addTo(speciesLayer.value)
    bounds.push([homeLat, homeLng])
  }

  map.value.invalidateSize(true)
  if (bounds.length) {
    map.value.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
  }
}

// Render nearest reserve and guidance line.
const renderReserve = () => {
  if (!map.value || !reserveLayer.value) return

  reserveLayer.value.clearLayers()
  if (!showReserves.value) return

  const reserve = mapData.value?.nearestReserve
  if (!reserve?.geometry) return

  const geoLayer = L.geoJSON(reserve.geometry, {
    style: {
      color: '#1f5f9f',
      weight: 4,
      fillColor: '#2f7fcb',
      fillOpacity: 0.34,
      dashArray: '8 5',
    },
  })
  geoLayer.addTo(reserveLayer.value)

  const homeLat = Number(mapData.value?.location?.lat)
  const homeLng = Number(mapData.value?.location?.lng)
  const reserveCenter = getGeometryCentroid(reserve.geometry)
  if (reserveCenter) {
    L.marker(reserveCenter, {
      interactive: false,
      icon: L.divIcon({
        className: 'reserve-name-marker',
        html: `<div class="reserve-name-chip">${reserve.name}</div>`,
      }),
    }).addTo(reserveLayer.value)
  }

  const closestLat = Number(reserve.closestPoint?.lat)
  const closestLng = Number(reserve.closestPoint?.lng)
  const targetPoint =
    Number.isFinite(closestLat) && Number.isFinite(closestLng)
      ? [closestLat, closestLng]
      : reserveCenter

  if (Number.isFinite(homeLat) && Number.isFinite(homeLng) && targetPoint) {
    L.polyline(
      [
        [homeLat, homeLng],
        targetPoint,
      ],
      {
        color: '#3f8ad5',
        weight: 3,
        dashArray: '7 5',
      },
    ).addTo(reserveLayer.value)

    const midLat = (homeLat + targetPoint[0]) / 2
    const midLng = (homeLng + targetPoint[1]) / 2
    L.marker([midLat, midLng], {
      interactive: false,
      icon: L.divIcon({
        className: 'distance-label-marker',
        html: `<span class="distance-label-text">${reserve.distanceLabel}</span>`,
      }),
    }).addTo(reserveLayer.value)
  }
}

// Handle input changes and reset suggestion state.
const onInputChange = () => {
  selectedSuggestion.value = null
}

// Choose a suggestion and write it back to query input.
const chooseSuggestion = (item) => {
  const postcodeStyle = String(item.label || '').includes('·')
  query.value = postcodeStyle
    ? [item.postcode, item.name].filter(Boolean).join(' ')
    : String(item.name || '')
  selectedSuggestion.value = item
  suggestions.value = []
}

// Normalize suggestion result schema for UI display.
const normalizeSuggestionList = (items, rawQuery) => {
  const q = String(rawQuery || '').trim().toLowerCase()
  const list = Array.isArray(items) ? items : []

  const filtered = list
    .filter((item) => {
      const name = String(item?.name || '').toLowerCase()
      const meta = String(item?.meta || '').toLowerCase()
      const postcode = String(item?.postcode || '').toLowerCase()
      const joined = `${name} ${meta} ${postcode}`
      if (!q) return true
      return name.includes(q) || joined.includes(q)
    })
    .sort((a, b) => {
      const aName = String(a?.name || '').toLowerCase()
      const bName = String(b?.name || '').toLowerCase()
      return aName.localeCompare(bName)
    })

  return filtered.slice(0, 8)
}

// Load map business data and trigger rendering.
const loadMapData = async () => {
  loading.value = true
  error.value = ''
  if (map.value) {
    map.value.invalidateSize(true)
  }

  try {
    const postcodeInput = getPostcodeFromInput(query.value)
    let picked = selectedSuggestion.value

    // If the user typed text but did not click a suggestion, auto-pick the top match.
    if (!picked && query.value.trim()) {
      const lookupQuery = postcodeInput || query.value
      const resp = await fetch(`/api/suburbs?q=${encodeURIComponent(lookupQuery)}&limit=8`)
      const payload = await resp.json()
      const refined = normalizeSuggestionList(payload?.results, lookupQuery)
      picked = refined[0] || null
      suggestions.value = refined
    }

    // Build API params differently for explicit suburb picks vs plain postcode input.
    let url = ''
    if (picked && picked.postcode) {
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

    // Load the full dataset, then switch to results mode and trigger map rendering.
    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load wildlife records')
    }

    mapData.value = data
    selectedSpecies.value = null
    viewMode.value = 'results'
    await ensureMapAndRender()
    // Transition timing on some browsers can delay container sizing.
    setTimeout(() => {
      ensureMapAndRender()
    }, 60)
    suggestions.value = []
  } catch (err) {
    error.value = err?.message || 'Unexpected map error'
  } finally {
    loading.value = false
  }
}

// Return from result view to entry view and reset state.
const backToEntry = () => {
  viewMode.value = 'entry'
}

watch(showReserves, () => {
  renderReserve()
})

watch(viewMode, async (mode) => {
  if (mode === 'results') {
    setTimeout(() => {
      ensureMapAndRender()
    }, 320)
  }
})

watch(query, async (value) => {
  const text = String(value || '').trim()
  if (suggestTimer) clearTimeout(suggestTimer)
  if (text.length < 2) {
    suggestions.value = []
    return
  }

  // Debounce suburb lookup to avoid rapid API calls while typing.
  suggestTimer = setTimeout(async () => {
    searchingSuggestions.value = true
    try {
      const resp = await fetch(`/api/suburbs?q=${encodeURIComponent(text)}&limit=8`)
      const data = await resp.json()
      suggestions.value = normalizeSuggestionList(data?.results, text)
    } catch {
      suggestions.value = []
    } finally {
      searchingSuggestions.value = false
    }
  }, 220)
})

onUnmounted(() => {
  if (suggestTimer) clearTimeout(suggestTimer)
  clearLayers()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<template>
  <section class="catwatch-page">
    <header class="hero">
      <div class="hero-top" :class="{ 'hero-top-results': viewMode === 'results' }">
        <button v-if="viewMode === 'results'" type="button" class="back-btn" @click="backToEntry">←</button>
        <h1>Wildlife Risk Map</h1>
        <span class="radius-badge">{{ radiusBadgeText }}</span>
      </div>

      <p v-if="viewMode === 'entry'" class="hint">Where is your home? We will show every threatened species recorded within 5km.</p>

      <form class="search-row" @submit.prevent="loadMapData">
        <div class="search-input-wrap">
          <input
            v-model="query"
            type="text"
            placeholder="Suburb or postcode"
            @input="onInputChange"
          />
          <ul v-if="suggestions.length" class="suggestions">
            <li v-for="item in suggestions" :key="item.id" @click="chooseSuggestion(item)">
              <strong>{{ item.label || item.name }}</strong>
            </li>
          </ul>
          <small v-if="searchingSuggestions" class="suggestion-loading">Searching...</small>
        </div>
        <button type="submit" :disabled="loading || !canSearch">
          {{ loading ? 'Loading...' : 'Search' }}
        </button>
      </form>
    </header>
    <Transition name="screen" mode="out-in">
      <div v-if="viewMode === 'entry'" key="entry" class="screen-panel">
        <div class="entry-empty">
          <div class="pin-circle">📍</div>
          <h2>Enter your suburb or postcode</h2>
          <p>Your map will show every native species recorded within 5km, pinned and colour-coded by their Victorian conservation status.</p>
          <div class="entry-legend">
            <span v-for="item in legendItems" :key="item.key">
              <i :style="{ backgroundColor: statusColor[item.key] }" />{{ item.label }}
            </span>
          </div>
        </div>
      </div>

      <div v-else key="results" class="screen-panel">
      <div class="summary-strip">
        <div class="summary-left">
          <strong>{{ threatenedCount }}</strong>
          <span>threatened species within</span>
          <em>5km</em>
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
            class="risk-filter-btn"
            :class="{ active: activeRiskFilter === 'all' }"
            @click="setRiskFilter('all')"
          >
            All ({{ riskCounts.all }})
          </button>
        </div>
        <span class="risk-pill">{{ highRiskText }}</span>
      </div>

      <div v-if="reserveBanner" class="reserve-banner">
        <h3>{{ reserveBanner.name }} - {{ reserveBanner.type }}</h3>
        <p>{{ reserveBanner.distanceLabel }} from your address · Simba could reach this boundary in a single outing.</p>
      </div>

        <div class="map-wrap">
          <div ref="mapEl" class="map-canvas" />

          <div class="legend">
            <span v-for="item in legendItems" :key="item.key" class="legend-item">
              <i :style="{ backgroundColor: statusColor[item.key] }" />{{ item.label }}
            </span>
            <label class="reserve-switch">
              <input v-model="showReserves" type="checkbox" />
              <span>Reserves</span>
            </label>
          </div>
        </div>

        <div v-if="selectedSpecies" class="detail-card">
          <div class="detail-head">
            <div>
              <h2>{{ selectedSpecies.commonName }}</h2>
              <p>{{ selectedSpecies.scientificName }}</p>
            </div>
            <button type="button" @click="selectedSpecies = null">×</button>
          </div>

          <div v-if="isHighRiskSpecies" class="risk-alert danger">
            <h4>{{ riskPanelTitle }}</h4>
            <p>{{ riskPanelBody }}</p>
          </div>
          <div v-else class="risk-alert">
            {{ riskPanelBody }}
          </div>

          <dl>
            <div>
              <dt>Conservation status</dt>
              <dd>
                <span class="status-pill" :class="`status-${selectedSpecies.riskLevel}`">
                  {{ formatConservation(selectedSpecies.conservationStatus) }}
                </span>
              </dd>
            </div>
            <div>
              <dt>Peak activity</dt>
              <dd>{{ selectedSpecies.activityWindowDetail || selectedSpecies.activityWindow }}</dd>
            </div>
            <div>
              <dt>Recorded near you</dt>
              <dd>{{ selectedSpecies.recordedCount3y }} times · past 3 yrs</dd>
            </div>
            <div>
              <dt>Simba's schedule risk</dt>
              <dd :class="{ 'overlap-yes': selectedSpecies.overlapWithSimba }">
                {{ overlapSummaryText }}
              </dd>
            </div>
          </dl>
        </div>

        <div v-else class="detail-empty">
          Tap a red, yellow, or green species pin to view details.
        </div>

        <div class="impact-cta">
          <p>
            Now that you know what's out there, check Simba's live scoreboard from your roaming logs.
          </p>
          <RouterLink to="/impact-score">View Simba's Scoreboard →</RouterLink>
        </div>
      </div>
    </Transition>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.catwatch-page {
  min-height: 100dvh;
  background: #f0f1ef;
  color: #1c2e27;
}

.screen-panel {
  min-height: 30vh;
}

.screen-enter-active,
.screen-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms ease;
}

.screen-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.screen-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.hero {
  background: linear-gradient(90deg, #123f2d 0%, #1a4a2f 65%, #275c37 100%);
  color: #f4f7f3;
  padding: 16px;
}

.hero-top {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
}

.hero-top-results {
  grid-template-columns: auto 1fr auto;
}

.back-btn {
  border: 0;
  border-radius: 999px;
  width: 34px;
  height: 34px;
  font-size: 1.1rem;
  color: #e5f0e8;
  background: rgba(255, 255, 255, 0.12);
}

.hero h1 {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.radius-badge {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  padding: 5px 10px;
  font-size: 0.95rem;
}

.hint {
  margin-top: 12px;
  background: #d7e1d8;
  color: #365f3d;
  border: 1px solid #abc2ad;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 1rem;
}

.search-row {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
}

.search-input-wrap {
  position: relative;
}

.search-row input {
  border: 1px solid #b8c0b6;
  border-radius: 12px 0 0 12px;
  padding: 12px;
  font-size: 1.15rem;
  width: 100%;
}

.search-row button {
  border: 0;
  border-radius: 0 12px 12px 0;
  background: #163d2f;
  color: #fff;
  padding: 0 18px;
  font-size: 1.2rem;
  font-weight: 700;
  min-height: 52px;
}

.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 1000;
  background: #fefefe;
  border: 1px solid #c9d0c7;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  margin: 0;
  padding: 6px;
  list-style: none;
  max-height: 230px;
  overflow: auto;
}

.suggestions li {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestions li:hover {
  background: #e8f0e8;
}

.suggestions li span {
  font-size: 0.9rem;
  color: #6f7570;
}

.suggestions li strong {
  color: #1f2d27;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.25;
}

.suggestion-loading {
  position: absolute;
  left: 10px;
  top: calc(100% + 8px);
  z-index: 1000;
  background: #eef1ec;
  border: 1px solid #c9d0c7;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.78rem;
  color: #5f6b62;
}

.entry-empty {
  min-height: 58dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}

.pin-circle {
  width: 110px;
  height: 110px;
  border-radius: 999px;
  background: #d9e3d8;
  display: grid;
  place-items: center;
  font-size: 2.1rem;
}

.entry-empty h2 {
  margin-top: 16px;
  font-size: 2.6rem;
  font-weight: 800;
  color: #252a27;
}

.entry-empty p {
  margin-top: 6px;
  max-width: 540px;
  color: #717573;
  font-size: 1.35rem;
}

.entry-legend {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  color: #757c76;
}

.entry-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.entry-legend i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.summary-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #ecefed;
  border-top: 1px solid #d6dad4;
  border-bottom: 1px solid #d6dad4;
  padding: 10px 14px;
  font-size: 1.12rem;
}

.summary-left {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 2px;
  align-items: baseline;
}

.summary-left strong {
  font-size: 1.85rem;
  line-height: 1;
  font-weight: 900;
}

.summary-left span {
  font-size: 1.05rem;
  color: #6d736f;
}

.summary-left em {
  font-style: normal;
  font-size: 1.05rem;
  color: #6d736f;
}

.summary-left small {
  grid-column: 1 / -1;
  margin-top: 3px;
  color: #5e6b62;
  font-size: 0.88rem;
  font-weight: 600;
}

.risk-pill {
  border: 1px solid #e68a8a;
  border-radius: 999px;
  color: #8d2f2f;
  background: #fbeeee;
  padding: 3px 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.reserve-banner {
  border-bottom: 1px solid #d5d8d5;
  border-left: 4px solid #2b79c7;
  background: #f7f9fd;
  padding: 14px;
}

.reserve-banner h3 {
  color: #1f66b3;
  font-size: 1.22rem;
  font-weight: 700;
}

.reserve-banner p {
  margin-top: 6px;
  color: #6f7372;
  font-size: 1.05rem;
}

.map-wrap {
  position: relative;
}

.map-canvas {
  height: 50dvh;
  min-height: 360px;
  width: 100%;
  background: #cad4ca;
}

.legend {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 550;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(247, 248, 247, 0.95);
  border-top: 1px solid #d9ddd8;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6b6b6b;
  font-size: 0.95rem;
}

.legend-item i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.risk-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: center;
  overflow-x: auto;
  padding: 0 8px;
}

.risk-filter-btn {
  border: 2px solid #bac5be;
  background: #f4f7f4;
  color: #435049;
  border-radius: 999px;
  min-height: 36px;
  padding: 6px 14px;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  flex: 0 0 auto;
}

.risk-filter-btn.active {
  border-color: #1d4c34;
  background: #dff0e2;
  color: #1d4c34;
}

.risk-filter-btn.high.active {
  border-color: #db8484;
  background: #fde8e8;
  color: #9e2f2f;
}

.risk-filter-btn.medium.active {
  border-color: #e7be76;
  background: #fff0d5;
  color: #87550c;
}

.risk-filter-btn.low.active {
  border-color: #a8c990;
  background: #eaf6e4;
  color: #3e6d31;
}

.reserve-switch {
  margin-left: auto;
  border: 1px solid #9ec3ea;
  border-radius: 999px;
  background: #e8f2fd;
  padding: 2px 10px 2px 6px;
  font-size: 0.98rem;
  color: #3e6f9f;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.reserve-switch input {
  appearance: none;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid #79aee7;
  background: #dbeafb;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
}

.reserve-switch input::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  transition: transform 0.2s ease;
}

.reserve-switch input:checked {
  background: #2f82d4;
  border-color: #2f82d4;
}

.reserve-switch input:checked::after {
  transform: translateX(14px);
}

.detail-empty {
  border-top: 1px solid #d9ddd8;
  background: #f8f8f8;
  color: #607066;
  padding: 14px;
  font-weight: 600;
}

.detail-card {
  background: #f8f8f8;
  border-top: 1px solid #d9ddd8;
  padding: 14px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 10px;
}

.detail-head h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #252a27;
}

.detail-head p {
  color: #848887;
  font-size: 1.1rem;
  font-style: italic;
}

.detail-head button {
  border: 0;
  background: transparent;
  color: #8a8f8b;
  font-size: 2rem;
  line-height: 1;
}

.risk-alert {
  margin-top: 10px;
  border: 1px solid #afc89f;
  border-left: 4px solid #7c9f5e;
  background: #e8f2de;
  color: #3f5f2f;
  padding: 10px;
  font-size: 1.0rem;
  line-height: 1.35;
}

.risk-alert.danger {
  border-color: #f1adad;
  border-left-color: #e14a4a;
  background: #fdeeee;
  color: #8d2d2d;
}

.risk-alert h4 {
  margin: 0;
  font-size: 1.95rem;
  font-weight: 800;
}

.risk-alert p {
  margin: 6px 0 0;
  font-size: 1.05rem;
}

.status-pill {
  border-radius: 999px;
  border: 1px solid #cfcfcf;
  padding: 2px 12px;
  font-size: 0.86rem;
  font-weight: 800;
}

.status-red {
  color: #a22f2f;
  border-color: #e4a3a3;
  background: #feecec;
}

.status-amber {
  color: #8f5a0a;
  border-color: #ecc17d;
  background: #fff4de;
}

.status-green {
  color: #3b6e2f;
  border-color: #b5d3a7;
  background: #ecf6e6;
}

dl {
  margin-top: 14px;
}

dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #dbdfda;
  padding: 10px 2px;
  font-size: 1.06rem;
}

dt {
  color: #757a77;
}

dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}

.overlap-yes {
  color: #ab2e2e;
}

:global(.reserve-name-marker) {
  background: transparent;
  border: 0;
}

:global(.reserve-name-chip) {
  display: inline-block;
  background: #1f66b3;
  color: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(31, 102, 179, 0.25);
}

:global(.distance-label-marker) {
  background: transparent;
  border: 0;
}

:global(.distance-label-text) {
  display: inline-block;
  color: #2b6cb2;
  font-weight: 800;
  font-size: 1.7rem;
  line-height: 1;
  text-shadow:
    0 1px 0 #ffffff,
    0 0 5px rgba(255, 255, 255, 0.75);
}

.error {
  color: #a12f2f;
  background: #feecec;
  border: 1px solid #efaaaa;
  margin: 14px;
  border-radius: 8px;
  padding: 10px 12px;
}

.impact-cta {
  border-top: 1px solid #d9ddd8;
  background: #f4f5f3;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.impact-cta p {
  margin: 0;
  color: #44544c;
  font-weight: 600;
}

.impact-cta a {
  text-decoration: none;
  color: #fff;
  background: #1b6a3b;
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 800;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .hero h1 {
    font-size: 1.7rem;
  }

  .entry-empty h2 {
    font-size: 1.95rem;
  }

  .entry-empty p {
    font-size: 1.15rem;
  }

  .summary-strip {
    font-size: 0.95rem;
  }

  .risk-pill {
    font-size: 0.88rem;
  }

  .detail-head h2 {
    font-size: 1.6rem;
  }

  dl > div {
    font-size: 0.96rem;
  }

  .impact-cta {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
