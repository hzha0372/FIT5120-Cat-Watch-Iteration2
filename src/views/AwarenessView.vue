<template>
  <main class="awareness-main">
    <header class="awareness-hero">
      <div>
        <h1 class="awareness-title">UV Awareness</h1>
        <p class="awareness-subtitle">
          See how UV changes across the day (often peaking around midday) so you can plan outdoor time
          safely.
        </p>
      </div>
    </header>

    <section class="awareness-card" aria-labelledby="uv-daily-title">
      <div class="card-head">
        <h2 id="uv-daily-title" class="card-title">UV throughout the day (Hourly)</h2>
        <p class="card-caption">
          Data source: Open-Meteo hourly forecast. Select your location to view today’s UV curve.
        </p>
      </div>

      <div class="control-row">
        <button @click="useCurrentLocation" :disabled="loading">Use My Location</button>
        <button @click="useMapLocation" :disabled="loading">Use Map Location</button>
        <span>or</span>
        <input
          v-model.trim="postcode"
          type="text"
          inputmode="numeric"
          maxlength="4"
          placeholder="Enter Australian postcode"
          aria-label="Enter Australian postcode"
        />
        <button @click="searchByPostcode" :disabled="loading || !postcode">Load UV</button>
      </div>

      <p v-if="loading">Loading hourly UV...</p>
      <p v-else-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <div v-if="locationLabel" class="location-pill">
        <strong>Location:</strong> {{ locationLabel }}
      </div>

      <div class="chart-wrapper">
        <div ref="chart" class="chart-surface" aria-label="Hourly UV line chart"></div>
      </div>

      <div v-if="summary" class="summary-grid" aria-label="UV summary">
        <div class="summary-item">
          <div class="summary-label">Peak UV</div>
          <div class="summary-value">{{ summary.peakUv }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Peak time</div>
          <div class="summary-value">{{ summary.peakTime }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Hours UV ≥ 3</div>
          <div class="summary-value">{{ summary.hoursUv3Plus }}</div>
        </div>
      </div>
    </section>

    <!-- Monthly UV Comparison: Melbourne vs Sydney -->
    <section class="awareness-card" aria-labelledby="uv-monthly-title">
      <div class="card-head">
        <h2 id="uv-monthly-title" class="card-title">Monthly UV Levels: Melbourne vs Sydney (2024)</h2>
        <p class="card-caption">
          Average daytime UV index (7 am–5 pm) measured across 2024. Source: BoM UV monitoring stations.
        </p>
      </div>
      <div class="uv-city-legend">
        <span class="legend-dot" style="background:#0ea5e9"></span> Melbourne
        <span class="legend-dot ml" style="background:#f97316"></span> Sydney
        <span class="legend-note">UV ≥ 3: protection recommended</span>
      </div>
      <div ref="monthlyChart" class="chart-surface" aria-label="Monthly UV comparison chart"></div>
    </section>

    <!-- Melanoma Trend in Australia -->
    <section class="awareness-card" aria-labelledby="melanoma-title">
      <div class="card-head">
        <h2 id="melanoma-title" class="card-title">Melanoma Incidence in Australia (1982–2019)</h2>
        <p class="card-caption">
          New melanoma cases per year by sex. Data: Australian Institute of Health and Welfare (AIHW).
        </p>
      </div>
      <div class="melanoma-legend">
        <span class="legend-dot" style="background:#0ea5e9"></span> Males
        <span class="legend-dot ml" style="background:#f43f5e"></span> Females
        <span class="legend-dot ml" style="background:#8b5cf6"></span> Persons (total)
      </div>
      <div ref="melanomaTrendChart" class="chart-surface" aria-label="Melanoma incidence trend chart"></div>
      <div class="melanoma-stat-row">
        <div class="mel-stat">
          <div class="mel-stat-label">Cases in 1982</div>
          <div class="mel-stat-value">7,070</div>
        </div>
        <div class="mel-stat">
          <div class="mel-stat-label">Cases in 2019</div>
          <div class="mel-stat-value">31,256</div>
        </div>
        <div class="mel-stat mel-stat--highlight">
          <div class="mel-stat-label">Increase over 37 years</div>
          <div class="mel-stat-value">+342%</div>
        </div>
        <div class="mel-stat">
          <div class="mel-stat-label">Most affected group</div>
          <div class="mel-stat-value">Males (58%)</div>
        </div>
      </div>
    </section>

    <!-- Sun Protection Self-Check -->
    <section class="awareness-card" aria-labelledby="suncheck-title">
      <div class="card-head">
        <h2 id="suncheck-title" class="card-title">Sun Protection Self-Check</h2>
        <p class="card-caption">
          Based on Australian sun protection behaviour surveys, tick what you actually do when outdoors during peak UV hours.
        </p>
      </div>
      <div class="suncheck-grid">
        <label
          v-for="m in sunProtMeasures"
          :key="m.code"
          class="suncheck-item"
          :class="{ 'suncheck-item--checked': sunProtChecked[m.code] }"
        >
          <input type="checkbox" v-model="sunProtChecked[m.code]" class="sr-only" />
          <span class="suncheck-icon">{{ m.icon }}</span>
          <span class="suncheck-label">{{ m.label }}</span>
          <span class="suncheck-tick">✓</span>
        </label>
      </div>
      <div class="suncheck-score-row" v-if="sunProtScore > 0">
        <div class="suncheck-bar-wrap">
          <div class="suncheck-bar" :style="{ width: sunProtScorePct + '%' }" :class="sunProtScoreClass"></div>
        </div>
        <div class="suncheck-score-label">
          <strong>{{ sunProtScore }}/{{ sunProtMeasures.length }}</strong> measures used —
          <span :class="sunProtScoreClass">{{ sunProtScoreText }}</span>
        </div>
      </div>
      <div v-if="sunProtScore === 0" class="suncheck-placeholder">
        Tick the measures above to see your coverage score.
      </div>
    </section>

    <!-- Skin Tone & UV Sensitivity Section -->
    <section class="awareness-card" aria-labelledby="skin-tone-title">
      <div class="card-head">
        <h2 id="skin-tone-title" class="card-title">Skin Tone &amp; UV Sensitivity</h2>
        <p class="card-caption">
          Select your skin tone (Fitzpatrick scale) to understand your personal UV risk and
          recommended sun protection level.
        </p>
      </div>

      <div class="skin-swatches" role="radiogroup" aria-label="Select your skin tone">
        <button
          v-for="tone in skinTones"
          :key="tone.type"
          class="skin-swatch"
          :class="{ 'skin-swatch--active': selectedSkinTone === tone.type }"
          :style="{ background: tone.color }"
          :aria-label="`Fitzpatrick Type ${tone.type}: ${tone.name}`"
          :aria-pressed="selectedSkinTone === tone.type"
          @click="selectedSkinTone = tone.type"
        >
          <span class="swatch-type">{{ tone.type }}</span>
        </button>
      </div>

      <transition name="skin-info-fade">
        <div v-if="activeSkinTone" class="skin-info-panel" :style="{ borderLeftColor: activeSkinTone.color }">
          <div class="skin-info-top">
            <div class="skin-color-dot" :style="{ background: activeSkinTone.color }"></div>
            <div>
              <div class="skin-type-label">Fitzpatrick Type {{ activeSkinTone.type }}</div>
              <div class="skin-type-name">{{ activeSkinTone.name }}</div>
            </div>
            <div class="skin-sensitivity-badge" :class="`sensitivity--${activeSkinTone.sensitivityKey}`">
              {{ activeSkinTone.sensitivity }}
            </div>
          </div>

          <div class="skin-details-grid">
            <div class="skin-detail-item">
              <div class="detail-label">Burn tendency</div>
              <div class="detail-value">{{ activeSkinTone.burnTendency }}</div>
            </div>
            <div class="skin-detail-item">
              <div class="detail-label">Tan tendency</div>
              <div class="detail-value">{{ activeSkinTone.tanTendency }}</div>
            </div>
            <div class="skin-detail-item">
              <div class="detail-label">Recommended SPF</div>
              <div class="detail-value">{{ activeSkinTone.spf }}</div>
            </div>
            <div class="skin-detail-item">
              <div class="detail-label">Safe sun exposure</div>
              <div class="detail-value">{{ activeSkinTone.safeExposure }}</div>
            </div>
          </div>

          <div class="skin-advice">
            <div class="skin-advice-title">Key advice for your skin tone</div>
            <ul class="skin-advice-list">
              <li v-for="tip in activeSkinTone.tips" :key="tip">{{ tip }}</li>
            </ul>
          </div>
        </div>
      </transition>

      <div v-if="!selectedSkinTone" class="skin-placeholder">
        Tap a skin tone above to see your personalised UV sensitivity guide.
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import * as d3 from 'd3'
import Map from '@/components/Map.vue'

// ── Skin Tone Selection ───────────────────────────────────────────────────────
const selectedSkinTone = ref(null)

const skinTones = [
  {
    type: 'I',
    name: 'Very Fair / Pale White',
    color: '#FDDAC4',
    sensitivity: 'Extreme',
    sensitivityKey: 'extreme',
    burnTendency: 'Always burns',
    tanTendency: 'Never tans',
    spf: 'SPF50+ (mandatory)',
    safeExposure: '5–10 min unprotected',
    tips: [
      'Apply SPF50+ 20 min before going outside and reapply every 2 hours.',
      'Seek shade between 10 am–4 pm when UV is highest.',
      'Wear UPF50+ clothing, wide-brim hat, and UV-blocking sunglasses.',
      'Even brief cloud cover does not block UV — stay protected.',
    ],
  },
  {
    type: 'II',
    name: 'Fair / White',
    color: '#F5C5A3',
    sensitivity: 'Very High',
    sensitivityKey: 'veryhigh',
    burnTendency: 'Usually burns',
    tanTendency: 'Rarely tans',
    spf: 'SPF50+',
    safeExposure: '10–15 min unprotected',
    tips: [
      'Daily SPF50+ is essential, even on overcast days.',
      'Reapply sunscreen after 2 hours, or after sweating or swimming.',
      'Protective clothing significantly reduces your UV exposure.',
      'Check the UV Index before outdoor activities — protect when UV ≥ 3.',
    ],
  },
  {
    type: 'III',
    name: 'Medium / Light Brown',
    color: '#E8A882',
    sensitivity: 'High',
    sensitivityKey: 'high',
    burnTendency: 'Sometimes burns',
    tanTendency: 'Gradually tans',
    spf: 'SPF30–50+',
    safeExposure: '15–20 min unprotected',
    tips: [
      'Use SPF30 minimum daily; SPF50+ during extended outdoor activities.',
      'UV damage accumulates over time — tanning is a sign of damage.',
      'Reapply sunscreen every 2 hours or after water/sweat exposure.',
      'Wear a hat and sunglasses on high-UV days (UV ≥ 6).',
    ],
  },
  {
    type: 'IV',
    name: 'Olive / Moderate Brown',
    color: '#C68642',
    sensitivity: 'Moderate',
    sensitivityKey: 'moderate',
    burnTendency: 'Rarely burns',
    tanTendency: 'Tans easily',
    spf: 'SPF30–50',
    safeExposure: '20–30 min unprotected',
    tips: [
      'SPF30+ is recommended for extended time outdoors.',
      'UV-induced damage and skin cancer risk are still real — melanin provides partial protection only.',
      'Apply sunscreen on exposed skin for any UV ≥ 3 situation.',
      'Skin cancer in darker skin is often diagnosed later — check your skin regularly.',
    ],
  },
  {
    type: 'V',
    name: 'Brown / Dark Brown',
    color: '#8D5524',
    sensitivity: 'Low–Moderate',
    sensitivityKey: 'low',
    burnTendency: 'Very rarely burns',
    tanTendency: 'Tans very easily',
    spf: 'SPF15–30',
    safeExposure: '30–40 min unprotected',
    tips: [
      'While burning is rare, UV damage and skin cancer risk still exist.',
      'SPF15 at minimum; use SPF30 for prolonged sun exposure.',
      'Regularly check for new or changing moles and spots.',
      'Vitamin D production is still possible with shorter unprotected exposure.',
    ],
  },
  {
    type: 'VI',
    name: 'Deeply Pigmented / Dark Brown–Black',
    color: '#4A2912',
    sensitivity: 'Low',
    sensitivityKey: 'low',
    burnTendency: 'Almost never burns',
    tanTendency: 'Deeply pigmented always',
    spf: 'SPF15+ recommended',
    safeExposure: '40+ min unprotected',
    tips: [
      'High melanin content gives natural UV protection, but does NOT eliminate skin cancer risk.',
      'UV damage including DNA mutation still occurs — sunscreen is still beneficial.',
      'Regular skin checks are important as skin cancer may be harder to detect.',
      'Consider SPF30 during extreme UV conditions (UV Index ≥ 11).',
    ],
  },
]

const activeSkinTone = computed(() =>
  selectedSkinTone.value
    ? skinTones.find((t) => t.type === selectedSkinTone.value) || null
    : null,
)
// ─────────────────────────────────────────────────────────────────────────────

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const postcode = ref('')
const loading = ref(false)
const errorMessage = ref('')

const mapLocation = ref({ center: { lng: 144.9631, lat: -37.8136 }, zoom: 12 })
const locationLabel = ref('')

const hourly = ref([])

const chart = ref(null)
let resizeHandler = null

const summary = computed(() => {
  if (!hourly.value.length) return null

  const sorted = [...hourly.value].sort((a, b) => a.time.getTime() - b.time.getTime())
  const peak = sorted.reduce((acc, cur) => (cur.uv > acc.uv ? cur : acc), sorted[0])

  const uv3PlusHours = sorted.filter((d) => d.uv >= 3).length
  const peakTime = peak.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return {
    peakUv: peak.uv.toFixed(1),
    peakTime,
    hoursUv3Plus: uv3PlusHours,
  }
})

const parseHourly = (data) => {
  const times = data?.hourly?.time
  const uvs = data?.hourly?.uv_index

  if (!Array.isArray(times) || !Array.isArray(uvs) || times.length !== uvs.length) {
    throw new Error('Hourly UV data not available for this location.')
  }

  return times
    .map((t, i) => ({
      time: new Date(t),
      uv: typeof uvs[i] === 'number' ? uvs[i] : Number(uvs[i]),
    }))
    .filter((d) => Number.isFinite(d.uv))
}

const fetchHourlyUvForCoordinates = async (latitude, longitude, label) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=uv_index&forecast_days=1&timezone=auto`,
    )
    const data = await response.json()

    hourly.value = parseHourly(data)
    locationLabel.value = label

    await nextTick()
    drawChart()
  } catch (error) {
    hourly.value = []
    locationLabel.value = ''
    errorMessage.value = error?.message || 'Failed to load hourly UV data.'
  } finally {
    loading.value = false
  }
}

const reverseGeocode = async (lng, lat) => {
  if (!mapboxToken) return ''

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,postcode&limit=1&access_token=${mapboxToken}`,
    )
    const data = await response.json()
    return data?.features?.[0]?.place_name || ''
  } catch {
    return ''
  }
}

const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    errorMessage.value = 'Geolocation is not supported by your browser.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude

      const label = (await reverseGeocode(lng, lat)) || 'Current location'
      await fetchHourlyUvForCoordinates(lat, lng, label)
    },
    async (error) => {
      if (error?.code === 1) {
        errorMessage.value =
          'Location permission was denied. Please allow location permission, or enter an Australian postcode.'
      } else {
        errorMessage.value = 'Could not determine your location. Please try again or use postcode.'
      }
      loading.value = false
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

const useMapLocation = async () => {
  const lng = mapLocation.value?.center?.lng
  const lat = mapLocation.value?.center?.lat

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    errorMessage.value = 'Please select a valid point on the map.'
    return
  }

  const label = (await reverseGeocode(lng, lat)) || 'Selected map location'
  await fetchHourlyUvForCoordinates(lat, lng, label)
}

const searchByPostcode = async () => {
  if (!mapboxToken) {
    errorMessage.value = 'Mapbox token missing. Set VITE_MAPBOX_TOKEN to enable postcode search.'
    return
  }
  if (!/^\d{4}$/.test(postcode.value)) {
    errorMessage.value = 'Please enter a valid 4-digit Australian postcode.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const geoResponse = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${postcode.value}.json?country=au&types=postcode&limit=1&access_token=${mapboxToken}`,
    )
    const geoData = await geoResponse.json()
    const feature = geoData?.features?.[0]

    if (!feature?.center) {
      throw new Error('Australian postcode not found. Please try another postcode.')
    }

    const [lng, lat] = feature.center
    const label = feature.place_name || `Postcode ${postcode.value}`

    await fetchHourlyUvForCoordinates(lat, lng, label)
  } catch (error) {
    hourly.value = []
    locationLabel.value = ''
    errorMessage.value = error?.message || 'Could not look up postcode.'
  } finally {
    loading.value = false
  }
}

const clearChart = () => {
  if (!chart.value) return
  d3.select(chart.value).selectAll('*').remove()
}

const drawChart = () => {
  clearChart()

  if (!chart.value || !hourly.value.length) return

  const container = chart.value
  const rect = container.getBoundingClientRect()

  const width = Math.max(320, Math.floor(rect.width))
  const height = 320

  const margin = { top: 18, right: 22, bottom: 44, left: 48 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const data = [...hourly.value].sort((a, b) => a.time.getTime() - b.time.getTime())

  const maxUv = d3.max(data, (d) => d.uv) || 0

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.time))
    .range([0, innerW])

  const y = d3
    .scaleLinear()
    .domain([0, Math.max(1, Math.ceil(maxUv))])
    .nice()
    .range([innerH, 0])

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const riskBands = [
    { from: 0, to: 2.9, color: 'rgba(34,197,94,0.10)' },
    { from: 3.0, to: 5.9, color: 'rgba(234,179,8,0.12)' },
    { from: 6.0, to: 7.9, color: 'rgba(249,115,22,0.12)' },
    { from: 8.0, to: Math.max(12, maxUv), color: 'rgba(239,68,68,0.10)' },
  ]

  g.selectAll('rect.risk')
    .data(riskBands)
    .enter()
    .append('rect')
    .attr('class', 'risk')
    .attr('x', 0)
    .attr('width', innerW)
    .attr('y', (d) => y(d.to))
    .attr('height', (d) => Math.max(0, y(d.from) - y(d.to)))
    .attr('fill', (d) => d.color)

  const line = d3
    .line()
    .x((d) => x(d.time))
    .y((d) => y(d.uv))
    .curve(d3.curveMonotoneX)

  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#0ea5e9').attr('stroke-width', 3).attr('d', line)

  const tip = d3
    .select(container)
    .append('div')
    .style('position', 'absolute')
    .style('padding', '6px 8px')
    .style('background', 'rgba(15,23,42,.90)')
    .style('color', '#fff')
    .style('font-size', '12px')
    .style('border-radius', '8px')
    .style('pointer-events', 'none')
    .style('opacity', 0)

  g.selectAll('circle.point')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'point')
    .attr('cx', (d) => x(d.time))
    .attr('cy', (d) => y(d.uv))
    .attr('r', 3)
    .attr('fill', '#0369a1')
    .on('mousemove', (e, d) => {
      const timeLabel = d.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      tip
        .style('opacity', 1)
        .html(`<b>${timeLabel}</b><br/>UV: ${d.uv.toFixed(1)}`)
        .style('left', e.offsetX + 14 + 'px')
        .style('top', e.offsetY - 10 + 'px')
    })
    .on('mouseleave', () => tip.style('opacity', 0))

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(Math.min(8, data.length)).tickFormat(d3.timeFormat('%H:%M')))

  g.append('g').call(d3.axisLeft(y).ticks(6))

  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 36)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(15,23,42,0.7)')
    .style('font-size', '12px')
    .text('Time (local)')

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -36)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(15,23,42,0.7)')
    .style('font-size', '12px')
    .text('UV Index')
}

watch(
  () => hourly.value.length,
  async () => {
    await nextTick()
    drawChart()
  },
)

watch(
  () => mapLocation.value,
  () => {
    // if you change map selection but haven't loaded data yet, do nothing
  },
  { deep: true },
)

const setupResize = () => {
  resizeHandler = () => {
    drawChart()
    drawMonthlyUvChart()
    drawMelanomaChart()
  }
  window.addEventListener('resize', resizeHandler)
}

setupResize()

// ── Dataset 1: Monthly UV – Melbourne vs Sydney (2024) ───────────────────────
const monthlyChart = ref(null)

const melbourneMonthlyUv = [
  { month: 1, city: 'Melbourne', avg_uv: 4.60 },
  { month: 2, city: 'Melbourne', avg_uv: 4.59 },
  { month: 3, city: 'Melbourne', avg_uv: 3.21 },
  { month: 4, city: 'Melbourne', avg_uv: 1.47 },
  { month: 5, city: 'Melbourne', avg_uv: 0.93 },
  { month: 6, city: 'Melbourne', avg_uv: 0.58 },
  { month: 7, city: 'Melbourne', avg_uv: 0.56 },
  { month: 8, city: 'Melbourne', avg_uv: 1.11 },
  { month: 9, city: 'Melbourne', avg_uv: 1.59 },
  { month: 10, city: 'Melbourne', avg_uv: 2.90 },
  { month: 11, city: 'Melbourne', avg_uv: 3.75 },
  { month: 12, city: 'Melbourne', avg_uv: 5.23 },
]

const sydneyMonthlyUv = [
  { month: 1, city: 'Sydney', avg_uv: 3.82 },
  { month: 2, city: 'Sydney', avg_uv: 3.18 },
  { month: 3, city: 'Sydney', avg_uv: 2.82 },
  { month: 4, city: 'Sydney', avg_uv: 2.09 },
  { month: 5, city: 'Sydney', avg_uv: 1.64 },
  { month: 6, city: 'Sydney', avg_uv: 1.65 },
  { month: 7, city: 'Sydney', avg_uv: 1.58 },
  { month: 8, city: 'Sydney', avg_uv: 1.88 },
  { month: 9, city: 'Sydney', avg_uv: 2.40 },
  { month: 10, city: 'Sydney', avg_uv: 3.27 },
  { month: 11, city: 'Sydney', avg_uv: 3.36 },
  { month: 12, city: 'Sydney', avg_uv: 4.87 },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const drawMonthlyUvChart = () => {
  if (!monthlyChart.value) return
  const container = monthlyChart.value
  d3.select(container).selectAll('*').remove()

  const rect = container.getBoundingClientRect()
  const width = Math.max(320, Math.floor(rect.width))
  const height = 260
  const margin = { top: 20, right: 24, bottom: 44, left: 48 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleBand().domain(MONTHS).range([0, innerW]).padding(0.2)
  const maxUv = 6
  const y = d3.scaleLinear().domain([0, maxUv]).nice().range([innerH, 0])

  // UV ≥ 3 band
  g.append('rect')
    .attr('x', 0).attr('width', innerW)
    .attr('y', y(maxUv)).attr('height', y(3) - y(maxUv))
    .attr('fill', 'rgba(239,68,68,0.06)')

  g.append('line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', y(3)).attr('y2', y(3))
    .attr('stroke', '#ef4444').attr('stroke-dasharray', '4,3').attr('stroke-width', 1)

  g.append('text')
    .attr('x', innerW - 4).attr('y', y(3) - 4)
    .attr('text-anchor', 'end').attr('fill', '#ef4444')
    .style('font-size', '10px').text('UV 3 — protection needed')

  const barW = x.bandwidth() / 2 - 1

  // Melbourne bars
  g.selectAll('.bar-mel')
    .data(melbourneMonthlyUv)
    .enter().append('rect')
    .attr('class', 'bar-mel')
    .attr('x', d => (x(MONTHS[d.month - 1]) || 0))
    .attr('y', d => y(d.avg_uv))
    .attr('width', barW)
    .attr('height', d => innerH - y(d.avg_uv))
    .attr('fill', '#0ea5e9').attr('rx', 3)

  // Sydney bars
  g.selectAll('.bar-syd')
    .data(sydneyMonthlyUv)
    .enter().append('rect')
    .attr('class', 'bar-syd')
    .attr('x', d => (x(MONTHS[d.month - 1]) || 0) + barW + 2)
    .attr('y', d => y(d.avg_uv))
    .attr('width', barW)
    .attr('height', d => innerH - y(d.avg_uv))
    .attr('fill', '#f97316').attr('rx', 3)

  // Tooltip
  const tip = d3.select(container).append('div')
    .style('position', 'absolute').style('padding', '6px 8px')
    .style('background', 'rgba(15,23,42,.9)').style('color', '#fff')
    .style('font-size', '12px').style('border-radius', '8px')
    .style('pointer-events', 'none').style('opacity', 0)

  const addTips = (sel, city) => {
    sel
      .on('mousemove', (e, d) => {
        tip.style('opacity', 1)
          .html(`<b>${MONTHS[d.month - 1]} — ${city}</b><br/>Avg UV: ${d.avg_uv}`)
          .style('left', e.offsetX + 14 + 'px')
          .style('top', e.offsetY - 10 + 'px')
      })
      .on('mouseleave', () => tip.style('opacity', 0))
  }
  addTips(g.selectAll('.bar-mel'), 'Melbourne')
  addTips(g.selectAll('.bar-syd'), 'Sydney')

  g.append('g').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll('text').style('font-size', '11px')

  g.append('g').call(d3.axisLeft(y).ticks(6))

  g.append('text').attr('x', innerW / 2).attr('y', innerH + 38)
    .attr('text-anchor', 'middle').attr('fill', 'rgba(15,23,42,0.7)').style('font-size', '12px').text('Month (2024)')

  g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -36)
    .attr('text-anchor', 'middle').attr('fill', 'rgba(15,23,42,0.7)').style('font-size', '12px').text('Avg UV Index')
}

// ── Dataset 2: Melanoma Incidence Trend (1982–2019) ──────────────────────────
const melanomaTrendChart = ref(null)

const melanomaTrendData = [
  { year: 1982, males: 3470, females: 3600, persons: 7070 },
  { year: 1983, males: 3640, females: 3957, persons: 7597 },
  { year: 1984, males: 3986, females: 4099, persons: 8085 },
  { year: 1985, males: 4445, females: 4572, persons: 9017 },
  { year: 1986, males: 4805, females: 4610, persons: 9415 },
  { year: 1987, males: 5754, females: 5370, persons: 11124 },
  { year: 1988, males: 6060, females: 5754, persons: 11814 },
  { year: 1989, males: 6536, females: 6024, persons: 12560 },
  { year: 1990, males: 7132, females: 6408, persons: 13540 },
  { year: 1991, males: 7334, females: 6566, persons: 13900 },
  { year: 1992, males: 7574, females: 6750, persons: 14324 },
  { year: 1993, males: 7990, females: 6982, persons: 14972 },
  { year: 1994, males: 8208, females: 7110, persons: 15318 },
  { year: 1995, males: 8628, females: 7456, persons: 16084 },
  { year: 1996, males: 9148, females: 7734, persons: 16882 },
  { year: 1997, males: 9452, females: 8010, persons: 17462 },
  { year: 1998, males: 9830, females: 8272, persons: 18102 },
  { year: 1999, males: 10164, females: 8490, persons: 18654 },
  { year: 2000, males: 10686, females: 8834, persons: 19520 },
  { year: 2001, males: 11248, females: 9248, persons: 20496 },
  { year: 2002, males: 11700, females: 9514, persons: 21214 },
  { year: 2003, males: 11928, females: 9700, persons: 21628 },
  { year: 2004, males: 12218, females: 9908, persons: 22126 },
  { year: 2005, males: 12818, females: 10282, persons: 23100 },
  { year: 2006, males: 13044, females: 10536, persons: 23580 },
  { year: 2007, males: 13218, females: 10544, persons: 23762 },
  { year: 2008, males: 13502, females: 10758, persons: 24260 },
  { year: 2009, males: 13884, females: 11050, persons: 24934 },
  { year: 2010, males: 13982, females: 11044, persons: 25026 },
  { year: 2011, males: 14080, females: 11210, persons: 25290 },
  { year: 2012, males: 14752, females: 11726, persons: 26478 },
  { year: 2013, males: 15454, females: 12292, persons: 27746 },
  { year: 2014, males: 15774, females: 12634, persons: 28408 },
  { year: 2015, males: 16028, females: 11422, persons: 27450 },
  { year: 2016, males: 16994, females: 12080, persons: 29074 },
  { year: 2017, males: 17650, females: 12274, persons: 29924 },
  { year: 2018, males: 17628, females: 12640, persons: 30270 },
  { year: 2019, males: 18268, females: 12988, persons: 31256 },
]

const drawMelanomaChart = () => {
  if (!melanomaTrendChart.value) return
  const container = melanomaTrendChart.value
  d3.select(container).selectAll('*').remove()

  const rect = container.getBoundingClientRect()
  const width = Math.max(320, Math.floor(rect.width))
  const height = 280
  const margin = { top: 18, right: 24, bottom: 44, left: 58 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const data = melanomaTrendData
  const x = d3.scaleLinear().domain([1982, 2019]).range([0, innerW])
  const maxVal = d3.max(data, d => d.persons) || 0
  const y = d3.scaleLinear().domain([0, Math.ceil(maxVal / 1000) * 1000]).nice().range([innerH, 0])

  const linePersons = d3.line().x(d => x(d.year)).y(d => y(d.persons)).curve(d3.curveMonotoneX)
  const lineMales   = d3.line().x(d => x(d.year)).y(d => y(d.males)).curve(d3.curveMonotoneX)
  const lineFemales = d3.line().x(d => x(d.year)).y(d => y(d.females)).curve(d3.curveMonotoneX)

  // Area fill for persons
  const areaPersons = d3.area()
    .x(d => x(d.year)).y0(innerH).y1(d => y(d.persons))
    .curve(d3.curveMonotoneX)

  g.append('path').datum(data).attr('fill', 'rgba(139,92,246,0.08)').attr('d', areaPersons)
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#8b5cf6').attr('stroke-width', 2.5).attr('d', linePersons)
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#0ea5e9').attr('stroke-width', 2).attr('d', lineMales)
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#f43f5e').attr('stroke-width', 2).attr('d', lineFemales)

  // Tooltip
  const tip = d3.select(container).append('div')
    .style('position', 'absolute').style('padding', '6px 10px')
    .style('background', 'rgba(15,23,42,.92)').style('color', '#fff')
    .style('font-size', '12px').style('border-radius', '8px')
    .style('pointer-events', 'none').style('opacity', 0)

  // Invisible overlay for hover
  g.append('rect')
    .attr('width', innerW).attr('height', innerH)
    .attr('fill', 'none').attr('pointer-events', 'all')
    .on('mousemove', (e) => {
      const [mx] = d3.pointer(e)
      const yr = Math.round(x.invert(mx))
      const d = data.find(r => r.year === yr)
      if (!d) return
      tip.style('opacity', 1)
        .html(`<b>${d.year}</b><br/>Persons: ${d.persons.toLocaleString()}<br/>Males: ${d.males.toLocaleString()}<br/>Females: ${d.females.toLocaleString()}`)
        .style('left', e.offsetX + 14 + 'px')
        .style('top', e.offsetY - 10 + 'px')
    })
    .on('mouseleave', () => tip.style('opacity', 0))

  g.append('g').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')))

  g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d => (d / 1000) + 'k'))

  g.append('text').attr('x', innerW / 2).attr('y', innerH + 38)
    .attr('text-anchor', 'middle').attr('fill', 'rgba(15,23,42,0.7)').style('font-size', '12px').text('Year')

  g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -46)
    .attr('text-anchor', 'middle').attr('fill', 'rgba(15,23,42,0.7)').style('font-size', '12px').text('New cases')
}

// ── Dataset 3: Sun Protection Self-Check (SUNPROT survey measures) ────────────
const sunProtMeasures = [
  { code: '1', icon: '🌳', label: 'Stayed in the shade' },
  { code: '2', icon: '🧴', label: 'Used SPF30+ sunscreen' },
  { code: '3', icon: '👕', label: 'Clothing covering arms (¾+)' },
  { code: '4', icon: '👖', label: 'Clothing covering legs (¾+)' },
  { code: '5', icon: '🕶️', label: 'Wore sunglasses' },
  { code: '6', icon: '🧢', label: 'Wore broad-brimmed hat' },
]

const sunProtChecked = ref({ '1': false, '2': false, '3': false, '4': false, '5': false, '6': false })

const sunProtScore = computed(() => Object.values(sunProtChecked.value).filter(Boolean).length)
const sunProtScorePct = computed(() => Math.round((sunProtScore.value / sunProtMeasures.length) * 100))
const sunProtScoreClass = computed(() => {
  const s = sunProtScore.value
  if (s >= 5) return 'score--great'
  if (s >= 3) return 'score--good'
  if (s >= 1) return 'score--low'
  return ''
})
const sunProtScoreText = computed(() => {
  const s = sunProtScore.value
  if (s >= 5) return 'Excellent protection!'
  if (s >= 3) return 'Good — consider adding more measures'
  if (s >= 1) return 'Limited — UV damage risk is higher'
  return ''
})

// Draw charts after mount
watch(
  monthlyChart,
  async (el) => {
    if (el) { await nextTick(); drawMonthlyUvChart() }
  },
)

watch(
  melanomaTrendChart,
  async (el) => {
    if (el) { await nextTick(); drawMelanomaChart() }
  },
)
// ─────────────────────────────────────────────────────────────────────────────

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.awareness-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 18px;
}

.awareness-hero {
  border-radius: 18px;
  padding: 20px 22px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(34, 197, 94, 0.08));
}

.awareness-title {
  margin: 0;
  font-size: 1.8rem;
}

.awareness-subtitle {
  margin: 8px 0 0;
  color: rgba(15, 23, 42, 0.75);
  max-width: 68ch;
}

.awareness-card {
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
  padding: 18px;
}

.card-head {
  margin-bottom: 14px;
}

.card-title {
  margin: 0;
  font-size: 1.2rem;
}

.card-caption {
  margin: 6px 0 0;
  color: rgba(15, 23, 42, 0.65);
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 12px 0;
}

.control-row input {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.18);
}

.control-row button {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 700;
  background: #0ea5e9;
  color: #ffffff;
}

.control-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-text {
  color: #b91c1c;
  font-weight: 600;
}

.location-pill {
  display: inline-block;
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
}

.chart-wrapper {
  margin-top: 12px;
  position: relative;
}

.chart-surface {
  width: 100%;
}

.summary-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.summary-item {
  border-radius: 14px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.02);
}

.summary-label {
  color: rgba(15, 23, 42, 0.6);
  font-weight: 600;
  font-size: 0.9rem;
}

.summary-value {
  font-weight: 800;
  font-size: 1.25rem;
  margin-top: 4px;
}

.placeholder-box {
  border-radius: 14px;
  padding: 18px;
  border: 1px dashed rgba(15, 23, 42, 0.22);
  color: rgba(15, 23, 42, 0.7);
  background: rgba(15, 23, 42, 0.02);
}

/* ── Skin Tone Selector ──────────────────────────────────────────────── */
.skin-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.skin-swatch {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  outline: none;
}

.skin-swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.skin-swatch--active {
  border-color: #0ea5e9;
  transform: scale(1.12);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.28), 0 4px 14px rgba(0, 0, 0, 0.2);
}

.swatch-type {
  font-weight: 900;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.skin-info-panel {
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-left: 5px solid #ccc;
  background: #fff;
  padding: 16px;
  display: grid;
  gap: 14px;
}

.skin-info-top {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.skin-color-dot {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.skin-type-label {
  font-size: 0.85rem;
  color: rgba(15, 23, 42, 0.6);
  font-weight: 700;
}

.skin-type-name {
  font-weight: 900;
  font-size: 1.05rem;
  margin-top: 2px;
}

.skin-sensitivity-badge {
  margin-left: auto;
  border-radius: 999px;
  padding: 5px 14px;
  font-weight: 800;
  font-size: 0.85rem;
}

.sensitivity--extreme  { background: rgba(239, 68, 68, 0.15);  color: #b91c1c; }
.sensitivity--veryhigh { background: rgba(249, 115, 22, 0.15); color: #c2410c; }
.sensitivity--high     { background: rgba(234, 179, 8, 0.18);  color: #92400e; }
.sensitivity--moderate { background: rgba(34, 197, 94, 0.15);  color: #15803d; }
.sensitivity--low      { background: rgba(14, 165, 233, 0.12); color: #0369a1; }

.skin-details-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.skin-detail-item {
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.detail-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.55);
  margin-bottom: 4px;
}

.detail-value {
  font-weight: 800;
  font-size: 0.92rem;
}

.skin-advice {
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.05);
  border: 1px solid rgba(14, 165, 233, 0.18);
  padding: 12px 14px;
}

.skin-advice-title {
  font-weight: 900;
  margin-bottom: 8px;
}

.skin-advice-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.skin-advice-list li {
  color: rgba(15, 23, 42, 0.85);
  line-height: 1.5;
}

.skin-placeholder {
  padding: 16px;
  border-radius: 14px;
  border: 1px dashed rgba(15, 23, 42, 0.22);
  color: rgba(15, 23, 42, 0.6);
  background: rgba(15, 23, 42, 0.02);
  text-align: center;
}

.skin-info-fade-enter-active,
.skin-info-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.skin-info-fade-enter-from,
.skin-info-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
/* ─────────────────────────────────────────────────────────────────────── */

/* ── Monthly UV + Melanoma charts ─────────────────────────────────────── */
.uv-city-legend,
.melanoma-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.88rem;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.75);
  margin-bottom: 10px;
}

.legend-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.ml {
  margin-left: 14px;
}

.legend-note {
  margin-left: 14px;
  font-weight: 600;
  color: #ef4444;
  font-size: 0.82rem;
}

.melanoma-stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.mel-stat {
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.mel-stat--highlight {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
}

.mel-stat-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.55);
  margin-bottom: 4px;
}

.mel-stat-value {
  font-weight: 900;
  font-size: 1.1rem;
}

.mel-stat--highlight .mel-stat-value {
  color: #dc2626;
}

/* ── Sun Protection Self-Check ─────────────────────────────────────────── */
.suncheck-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.suncheck-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.suncheck-item--checked {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.08);
}

.suncheck-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.suncheck-label {
  flex: 1;
  font-weight: 700;
  font-size: 0.88rem;
  line-height: 1.3;
}

.suncheck-tick {
  font-weight: 900;
  color: transparent;
  transition: color 0.15s;
}

.suncheck-item--checked .suncheck-tick {
  color: #16a34a;
}

.suncheck-score-row {
  display: grid;
  gap: 6px;
}

.suncheck-bar-wrap {
  height: 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.suncheck-bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.score--great { background: #22c55e; color: #15803d; }
.score--good  { background: #f59e0b; color: #92400e; }
.score--low   { background: #ef4444; color: #b91c1c; }

.suncheck-score-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.8);
}

.suncheck-placeholder {
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(15, 23, 42, 0.2);
  color: rgba(15, 23, 42, 0.6);
  text-align: center;
}
/* ─────────────────────────────────────────────────────────────────────── */

@media (max-width: 840px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .skin-details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .melanoma-stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .suncheck-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
