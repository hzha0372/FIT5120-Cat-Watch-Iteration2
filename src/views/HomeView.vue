<template>
  <main class="home-shell">
    <header class="hero">
      <div>
        <h1 class="hero-title">Sun Safety Dashboard</h1>
        <p class="hero-subtitle">
          Click anywhere on the Melbourne map to see the UV level, what it means for your skin, and
          what to do next.
        </p>
      </div>
    </header>

    <section class="layout">
      <div class="main">
        <section class="card" aria-labelledby="uv-title">
          <div class="card-head">
            <h2 id="uv-title" class="card-title">1) Location-based UV levels (Melbourne)</h2>
            <p class="card-caption">Select a point on the map to load hourly UV from Open-Meteo.</p>
          </div>

          <div class="map-grid">
            <div class="map-col">
              <Map v-model="mapLocation" height="420px" aria-label="Melbourne UV map" />
              <div class="map-hint">
                Selected: {{ mapLocation.center.lng.toFixed(4) }}, {{ mapLocation.center.lat.toFixed(4) }}
              </div>
            </div>

            <div class="info-col">
              <div class="metric">
                <div class="metric-label">Selected location UV (peak today)</div>
                <div class="metric-value">{{ uvSummary ? uvSummary.peakUv : '—' }}</div>
                <div v-if="uvSummary" class="metric-sub">
                  Peak time: {{ uvSummary.peakTime }} | Hours UV ≥ 3: {{ uvSummary.hoursUv3Plus }}
                </div>
              </div>

              <div v-if="uvSummary" class="alert" :class="alertClass" role="alert" aria-live="polite">
                <div class="alert-title">{{ alertContent.title }}</div>
                <div class="alert-main">{{ alertContent.main }}</div>
                <div class="alert-detail">
                  Short-term: {{ alertContent.shortTerm }}
                </div>
                <div class="alert-detail">
                  Long-term: {{ alertContent.longTerm }}
                </div>
              </div>
              <div v-else class="placeholder">Click the map to load UV data.</div>

              <p v-if="loading" class="status">Loading hourly UV…</p>
              <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
            </div>
          </div>

          <div class="chart-area">
            <div class="chart-title">UV throughout the day (hourly)</div>
            <div ref="chart" class="chart-surface" aria-label="Hourly UV chart"></div>
          </div>
        </section>

        <section class="card" aria-labelledby="sunscreen-title">
          <div class="card-head">
            <h2 id="sunscreen-title" class="card-title">2) Sunscreen amount and type</h2>
            <p class="card-caption">
              Guidance updates based on the UV you selected. Apply 20 minutes before going outside.
            </p>
          </div>

          <div class="sunscreen-grid">
            <div class="sunscreen-box">
              <div class="sunscreen-label">Recommended type</div>
              <div class="sunscreen-value">SPF50 / SPF50+</div>
              <div class="sunscreen-detail">High UV in Australia makes higher SPF a safer default for daily use.</div>
            </div>

            <div class="sunscreen-box">
              <div class="sunscreen-label">Estimated amount (adult body)</div>
              <div class="sunscreen-value">{{ sunscreenGuide.amount }}</div>
              <div class="sunscreen-detail">Aim for full coverage on exposed skin. Reapply at least every 2 hours.</div>
            </div>

            <div class="sunscreen-box">
              <div class="sunscreen-label">Reapply sooner if</div>
              <div class="sunscreen-value">Sweating / swimming</div>
              <div class="sunscreen-detail">If you’re active or in water, reapply more frequently (and after towelling).</div>
            </div>
          </div>

          <div class="sunscreen-note">
            Current UV context: <strong>{{ uvSummary ? uvSummary.peakUv : '—' }}</strong>
            <span v-if="uvSummary">({{ riskLabel }})</span>
          </div>
        </section>
      </div>

      <aside class="side" aria-label="Myth versus fact">
        <section class="card sticky" aria-labelledby="myth-title">
          <div class="card-head">
            <h2 id="myth-title" class="card-title">3) Myth vs Fact</h2>
            <p class="card-caption">Tap a myth to see the fact and what to do instead.</p>
          </div>

          <div class="qa">
            <details class="qa-item" open>
              <summary class="qa-q">Myth: “I only need sunscreen at the beach.”</summary>
              <div class="qa-a">
                <p>
                  <strong>Fact:</strong> UV can be high on everyday errands, outdoor sports, and even on cooler or
                  cloudy days. If UV is 3 or above, sun protection is recommended.
                </p>
                <p>
                  <strong>Do this:</strong> Check UV before you head out, apply sunscreen to exposed skin, and plan
                  shade breaks around midday.
                </p>
              </div>
            </details>

            <details class="qa-item">
              <summary class="qa-q">Myth: “Only fair-skinned people need protection.”</summary>
              <div class="qa-a">
                <p>
                  <strong>Fact:</strong> All skin tones can experience UV damage. Darker skin may burn less often,
                  but UV can still cause long-term damage and skin cancer.
                </p>
                <p>
                  <strong>Do this:</strong> Use sunscreen, protective clothing, and shade when UV is 3 or above—no
                  matter your skin tone.
                </p>
              </div>
            </details>

            <details class="qa-item">
              <summary class="qa-q">Myth: “Sunscreen prevents Vitamin D.”</summary>
              <div class="qa-a">
                <p>
                  <strong>Fact:</strong> You can still maintain Vitamin D while protecting your skin. If you’re
                  concerned, talk to a health professional rather than skipping protection during high UV.
                </p>
                <p>
                  <strong>Do this:</strong> Keep sun protection habits and use diet/supplements if recommended.
                </p>
              </div>
            </details>
          </div>

          <div class="sources" aria-label="Sources">
            <div class="sources-title">Sources</div>
            <a class="source-link" href="https://www.cancervic.org.au/get-support/stories/7-myths-about-sun-protection.html" target="_blank" rel="noreferrer">Cancer Council Victoria: Sun protection myths</a>
            <a class="source-link" href="https://www.mdanderson.org/cancerwise/sunscreen-myths-debunked.h00-159697545.html" target="_blank" rel="noreferrer">MD Anderson: Sunscreen myths debunked</a>
            <a class="source-link" href="https://www.youtube.com/watch?v=Uo4X12y5yAk" target="_blank" rel="noreferrer">Video: Sunscreen myths</a>
            <a class="source-link" href="https://www.youtube.com/watch?v=So27AO7JCEA" target="_blank" rel="noreferrer">Video: UV & sun safety</a>
          </div>

          <div class="live-box">
            <div class="live-title">Live impact feed</div>
            <div class="live-body">
              <div class="live-metric">
                <div class="live-label">Data feed</div>
                <div class="live-value">{{ impactFeed.status }}</div>
              </div>
              <div class="live-metric">
                <div class="live-label">People impacted (today)</div>
                <div class="live-value">{{ impactFeed.peopleToday }}</div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import * as d3 from 'd3'
import Map from '@/components/Map.vue'

const loading = ref(false)
const errorMessage = ref('')

const mapLocation = ref({ center: { lng: 144.9631, lat: -37.8136 }, zoom: 11 })

const hourly = ref([])
const chart = ref(null)
let resizeHandler = null

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

const fetchHourlyUv = async (lat, lng) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=uv_index&forecast_days=1&timezone=auto`,
    )
    const data = await response.json()
    hourly.value = parseHourly(data)
    await nextTick()
    drawChart()
  } catch (e) {
    hourly.value = []
    errorMessage.value = e?.message || 'Failed to load hourly UV.'
  } finally {
    loading.value = false
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

const sunscreenGuide = computed(() => {
  const uv = uvSummary.value?.peakUvNumber
  if (!Number.isFinite(uv)) return { amount: 'Use the map to load UV first' }

  if (uv < 3) {
    return { amount: 'Optional (extended outdoor time)' }
  }
  if (uv < 6) {
    return { amount: '7 teaspoons (full body) or 2 finger-lengths per arm' }
  }
  if (uv < 8) {
    return { amount: '7 teaspoons + prioritise reapplication every 2 hours' }
  }
  return { amount: '7 teaspoons + reapply more often (sweat/water/peak UV)' }
})

const impactFeed = ref({ status: 'Waiting for dataset', peopleToday: '—' })

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
  const height = 280

  const margin = { top: 18, right: 20, bottom: 42, left: 46 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const data = [...hourly.value].sort((a, b) => a.time.getTime() - b.time.getTime())
  const maxUv = d3.max(data, (d) => d.uv) || 0

  const x = d3.scaleTime().domain(d3.extent(data, (d) => d.time)).range([0, innerW])
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(1, Math.ceil(maxUv))])
    .nice()
    .range([innerH, 0])

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
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

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#0ea5e9')
    .attr('stroke-width', 3)
    .attr('d', line)

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
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat('%H:%M')))

  g.append('g').call(d3.axisLeft(y).ticks(6))
}

watch(
  () => ({ lng: mapLocation.value.center.lng, lat: mapLocation.value.center.lat }),
  async ({ lng, lat }) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    await fetchHourlyUv(lat, lng)
  },
  { deep: true, immediate: true },
)

resizeHandler = () => drawChart()
window.addEventListener('resize', resizeHandler)

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.home-shell {
  max-width: 1220px;
  margin: 0 auto;
  padding: 22px;
  display: grid;
  gap: 16px;
}

.hero {
  border-radius: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(34, 197, 94, 0.08));
}

.hero-title {
  margin: 0;
  font-size: 2rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  margin: 8px 0 0;
  color: rgba(15, 23, 42, 0.75);
  max-width: 72ch;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  align-items: start;
}

.card {
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.card-head {
  margin-bottom: 12px;
}

.card-title {
  margin: 0;
  font-size: 1.15rem;
}

.card-caption {
  margin: 6px 0 0;
  color: rgba(15, 23, 42, 0.65);
}

.map-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 12px;
  align-items: start;
}

.map-hint {
  margin-top: 10px;
  color: rgba(15, 23, 42, 0.65);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.9rem;
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

.alert {
  margin-top: 12px;
  border-radius: 14px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
}

.alert-title {
  font-weight: 900;
  font-size: 1rem;
}

.alert-main {
  margin-top: 4px;
  font-weight: 700;
}

.alert-detail {
  margin-top: 6px;
  color: rgba(15, 23, 42, 0.8);
}

.alert--low {
  background: rgba(34, 197, 94, 0.10);
}

.alert--moderate {
  background: rgba(234, 179, 8, 0.12);
}

.alert--high {
  background: rgba(249, 115, 22, 0.12);
}

.alert--veryhigh,
.alert--extreme {
  background: rgba(239, 68, 68, 0.10);
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

.chart-area {
  margin-top: 14px;
  position: relative;
}

.chart-title {
  font-weight: 900;
  margin-bottom: 6px;
}

.chart-surface {
  width: 100%;
  position: relative;
}

.sunscreen-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.sunscreen-box {
  border-radius: 14px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.02);
}

.sunscreen-label {
  color: rgba(15, 23, 42, 0.6);
  font-weight: 800;
  font-size: 0.9rem;
}

.sunscreen-value {
  font-weight: 900;
  font-size: 1.2rem;
  margin-top: 4px;
}

.sunscreen-detail {
  margin-top: 6px;
  color: rgba(15, 23, 42, 0.75);
}

.sunscreen-note {
  margin-top: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.sticky {
  position: sticky;
  top: 16px;
}

.qa {
  display: grid;
  gap: 10px;
}

.qa-item {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(15, 23, 42, 0.02);
  padding: 10px 12px;
}

.qa-q {
  cursor: pointer;
  font-weight: 900;
}

.qa-a {
  margin-top: 8px;
  color: rgba(15, 23, 42, 0.85);
}

.sources {
  margin-top: 14px;
  display: grid;
  gap: 6px;
}

.sources-title {
  font-weight: 900;
  margin-bottom: 2px;
}

.source-link {
  color: #0369a1;
  text-decoration: none;
  font-weight: 700;
}

.source-link:hover {
  text-decoration: underline;
}

.live-box {
  margin-top: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 12px;
  background: rgba(14, 165, 233, 0.06);
}

.live-title {
  font-weight: 900;
  margin-bottom: 8px;
}

.live-body {
  display: grid;
  gap: 8px;
}

.live-metric {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 10px;
}

.live-label {
  color: rgba(15, 23, 42, 0.7);
  font-weight: 800;
}

.live-value {
  font-weight: 900;
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .sticky {
    position: static;
  }
  .map-grid {
    grid-template-columns: 1fr;
  }
  .sunscreen-grid {
    grid-template-columns: 1fr;
  }
}
</style>
