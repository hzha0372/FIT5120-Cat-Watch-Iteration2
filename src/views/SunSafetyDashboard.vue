<template>
  <main class="sun-main">
    <h1 id="sun-header">Sun Safety Dashboard</h1>
    <p>
      Track UV risk by current location, map selection, or Australian postcode. Clothing advice is
      shown automatically when today's max UV is 3 or above.
    </p>

    <section class="feature-card" aria-labelledby="uv-tracking-title">
      <h2 id="uv-tracking-title">Location Based UV Levels</h2>
      <p>
        Use your current location, select a point on the map, or enter an Australian postcode to
        check today's maximum UV and risk level.
      </p>

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
        <button @click="searchByPostcode" :disabled="loading || !postcode">Check UV</button>
      </div>

      <p v-if="loading">Loading today's max UV...</p>
      <p v-else-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <div v-if="uvResult" class="result-box">
        <p><strong>Location:</strong> {{ uvResult.locationName }}</p>
        <p><strong>Today's Max UV:</strong> {{ uvResult.todayMaxUv }}</p>
        <p><strong>Risk Level:</strong> {{ uvResult.riskLevel }}</p>
      </div>

      <div
        v-if="showUvWarning"
        class="uv-warning"
        role="alert"
        aria-live="assertive"
        :class="uvWarningClass"
      >
        <div class="uv-warning-title">{{ uvWarningContent.title }}</div>
        <p class="uv-warning-message">{{ uvWarningContent.main }}</p>
        <p class="uv-warning-detail">
          Short-term impact: {{ uvWarningContent.shortTerm }}
        </p>
        <p class="uv-warning-detail">
          Long-term impact: {{ uvWarningContent.longTerm }}
        </p>
      </div>

      <div class="map-panel" aria-label="Map selection">
        <Map v-model="mapLocation" aria-label="Select location on map" />
      </div>
    </section>

    <section class="feature-card" aria-labelledby="clothing-title">
      <h2 id="clothing-title">Clothing Choice Advice</h2>
      <p v-if="!uvResult">Check UV first to receive recommendations.</p>
      <p v-else-if="uvResult.todayMaxUv < 3.0">
        Today's max UV is below 3. Keep basic protection ready, and check again near midday.
      </p>
      <ul v-else class="advice-list">
        <li v-for="advice in clothingAdvice" :key="advice">{{ advice }}</li>
      </ul>
    </section>

    <section class="feature-card" aria-labelledby="clothing-uv-title">
      <h2 id="clothing-uv-title">Clothing Recommendations by UV Level</h2>
      <p>
        Use this quick guide to plan what to wear. When today's max UV is available, the
        recommended row is highlighted.
      </p>
      <div class="uv-table" role="table" aria-label="Clothing recommendations by UV level">
        <div class="uv-table__header" role="row">
          <span role="columnheader">UV Level</span>
          <span role="columnheader">Clothing Recommendations</span>
        </div>
        <div
          v-for="row in clothingByUvLevel"
          :key="row.label"
          class="uv-table__row"
          role="row"
          :class="{ 'uv-table__row--active': row.isActive }"
        >
          <span role="cell" class="uv-table__label">{{ row.label }}</span>
          <span role="cell" class="uv-table__text">{{ row.advice }}</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import Map from '@/components/Map.vue'

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const postcode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const uvResult = ref(null)
const weatherContext = ref({ temperature: null })
const mapLocation = ref({ center: { lng: 144.9631, lat: -37.8136 }, zoom: 12 })

const uvRiskLevel = (value) => {
  if (value <= 2.9) return 'Low (0.0-2.9)'
  if (value <= 5.9) return 'Moderate (3.0-5.9)'
  if (value <= 7.9) return 'High (6.0-7.9)'
  if (value <= 10.9) return 'Very High (8.0-10.9)'
  return 'Extreme (11.0+)'
}

const uvDescriptor = (value) => {
  if (value <= 2.9) return 'Low'
  if (value <= 5.9) return 'Moderate'
  if (value <= 7.9) return 'High'
  if (value <= 10.9) return 'Very High'
  return 'Extreme'
}

const uvWarningContent = computed(() => {
  if (!uvResult.value) {
    return {
      title: '',
      main: '',
      shortTerm: '',
      longTerm: '',
    }
  }

  const uv = uvResult.value.todayMaxUv

  if (uv >= 11.0) {
    return {
      title: `${uvDescriptor(uv)} UV Warning`,
      main: 'CRITICAL: Severe burning in under 15 mins - seek shade NOW.',
      shortTerm: 'Severe burning in under 15 mins - immediate protection needed.',
      longTerm: 'Extreme risk of melanoma and permanent skin aging.',
    }
  }

  if (uv >= 8.0) {
    return {
      title: `${uvDescriptor(uv)} UV Warning`,
      main: 'URGENT: 15 mins max before damage - protect yourself immediately.',
      shortTerm: 'Skin damage starts immediately, burning within minutes.',
      longTerm: 'High risk of DNA damage and skin cancer over time.',
    }
  }

  if (uv >= 6.0) {
    return {
      title: `${uvDescriptor(uv)} UV Warning`,
      main: 'You have about 15 mins - find shade or apply sunscreen now.',
      shortTerm: 'Skin will begin burning after 15 mins of exposure.',
      longTerm: 'Repeated burning leads to permanent skin damage and higher cancer risk.',
    }
  }

  return {
    title: `${uvDescriptor(uv)} UV Warning`,
    main: 'You have 15-20 mins before skin starts to burn - time to prepare.',
    shortTerm: 'Skin may start to redden after 15 mins of exposure.',
    longTerm: 'Regular exposure increases risk of premature aging.',
  }
})

const uvWarningClass = computed(() => {
  if (!uvResult.value) return ''
  const uv = uvResult.value.todayMaxUv
  if (uv < 3.0) return ''
  if (uv <= 5.9) return 'uv-warning--green'
  if (uv <= 7.9) return 'uv-warning--yellow'
  if (uv <= 10.9) return 'uv-warning--orange'
  return 'uv-warning--red'
})

const showUvWarning = computed(
  () => !!uvResult.value && uvResult.value.todayMaxUv >= 3,
)

const fetchUvForCoordinates = async (latitude, longitude, locationName) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&daily=uv_index_max&forecast_days=1&timezone=auto`,
    )
    const data = await response.json()
    const temperature = data?.current?.temperature_2m
    const todayMaxUv = data?.daily?.uv_index_max?.[0]

    if (typeof todayMaxUv !== 'number') {
      throw new Error("Unable to fetch today's max UV for this location.")
    }
    const normalizedUv = Math.round(todayMaxUv * 10) / 10

    weatherContext.value = {
      temperature: typeof temperature === 'number' ? temperature : null,
    }

    uvResult.value = {
      locationName,
      todayMaxUv: normalizedUv,
      riskLevel: uvRiskLevel(normalizedUv),
    }
  } catch (error) {
    uvResult.value = null
    weatherContext.value = { temperature: null }
    errorMessage.value = error.message || 'Failed to load UV information.'
  } finally {
    loading.value = false
  }
}

const fetchUvForIpLocation = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch('https://ipapi.co/json/')
    if (!response.ok) {
      throw new Error('Unable to infer location from IP.')
    }
    const data = await response.json()
    const latitude = Number(data?.latitude)
    const longitude = Number(data?.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Unable to infer location from IP.')
    }

    const locationName = [data?.city, data?.region, data?.country_name].filter(Boolean).join(', ')

    await fetchUvForCoordinates(
      latitude,
      longitude,
      locationName ? `${locationName} (approx.)` : 'Approximate location (IP-based)',
    )
  } catch (error) {
    uvResult.value = null
    weatherContext.value = { temperature: null }
    errorMessage.value =
      error.message ||
      'Could not determine location. Please retry, or enter an Australian postcode.'
    loading.value = false
  }
}

const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    fetchUvForIpLocation()
    return
  }

  if (!window.isSecureContext) {
    fetchUvForIpLocation()
    return
  }

  loading.value = true
  errorMessage.value = ''

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords
      await fetchUvForCoordinates(latitude, longitude, 'Your current location')
    },
    (error) => {
      loading.value = false

      if (error?.code === 1) {
        errorMessage.value =
          'Location permission was denied. Please allow location permission, or enter an Australian postcode.'
      } else if (error?.code === 2) {
        fetchUvForIpLocation()
      } else if (error?.code === 3) {
        fetchUvForIpLocation()
      } else {
        fetchUvForIpLocation()
      }
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 },
  )
}

const useMapLocation = async () => {
  if (!mapboxToken) {
    errorMessage.value = 'Mapbox token missing. Set VITE_MAPBOX_TOKEN to enable map search.'
    return
  }
  const { lng, lat } = mapLocation.value.center || {}
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    errorMessage.value = 'Map location is unavailable. Please move the map and try again.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,postcode&limit=1&access_token=${mapboxToken}`,
    )
    const data = await response.json()
    const place = data?.features?.[0]?.place_name
    await fetchUvForCoordinates(lat, lng, place || 'Selected map location')
  } catch (error) {
    uvResult.value = null
    weatherContext.value = { temperature: null }
    errorMessage.value = error.message || 'Could not use the selected map location.'
    loading.value = false
  }
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

    const [longitude, latitude] = feature.center

    await fetchUvForCoordinates(
      latitude,
      longitude,
      feature.place_name || `Postcode ${postcode.value}`,
    )
  } catch (error) {
    uvResult.value = null
    weatherContext.value = { temperature: null }
    errorMessage.value = error.message || 'Could not look up postcode.'
    loading.value = false
  }
}

const clothingAdvice = computed(() => {
  if (!uvResult.value || uvResult.value.todayMaxUv < 3.0) return []

  const uv = uvResult.value.todayMaxUv
  const temp = weatherContext.value.temperature
  const advice = []

  if (uv <= 5.9) {
    advice.push(
      'Moderate UV: wear a long-sleeve shirt or a light rash vest.',
      'Add a broad-brim hat and sunglasses for face and eye protection.',
      'Use SPF50+ sunscreen and reapply every 2 hours.',
    )
  } else if (uv <= 7.9) {
    advice.push(
      'High UV: choose tightly woven long sleeves and long pants.',
      'Wear a broad-brim hat and UV-rated sunglasses.',
      'Plan shade breaks between 10am and 4pm.',
    )
  } else if (uv <= 10.9) {
    advice.push(
      'Very high UV: cover up with UPF long sleeves or a rash vest.',
      'Prioritise shade and limit outdoor time at peak hours.',
      'Apply SPF50+ sunscreen and reapply every 2 hours.',
    )
  } else {
    advice.push(
      'Extreme UV: avoid direct sun during peak hours; stay indoors or in deep shade.',
      'Wear UPF long sleeves, long pants, and a broad-brim hat.',
      'Use SPF50+ sunscreen and reapply every 2 hours.',
    )
  }

  if (temp !== null && temp >= 28) {
    advice.push(
      'Hot weather: choose lightweight breathable UPF clothing for comfort and protection.',
    )
  }

  return advice
})

const clothingByUvLevel = computed(() => {
  const uv = uvResult.value?.todayMaxUv ?? null
  const buildRow = (label, advice, isActive) => ({
    label,
    advice,
    isActive,
  })

  return [
    buildRow(
      'Low (0.0-2.9)',
      'Normal clothing is fine. Keep sunglasses and a hat ready for midday.',
      uv !== null && uv < 3.0,
    ),
    buildRow(
      'Moderate (3.0-5.9)',
      'Long sleeves or light UPF layers, plus a broad-brim hat and sunglasses.',
      uv !== null && uv >= 3.0 && uv <= 5.9,
    ),
    buildRow(
      'High (6.0-7.9)',
      'Tightly woven long sleeves and long pants with a broad-brim hat.',
      uv !== null && uv >= 6.0 && uv <= 7.9,
    ),
    buildRow(
      'Very High (8.0-10.9)',
      'UPF long sleeves or rash vest, long pants, and minimise time outdoors.',
      uv !== null && uv >= 8.0 && uv <= 10.9,
    ),
    buildRow(
      'Extreme (11.0+)',
      'Full coverage UPF clothing, wide-brim hat, and avoid direct sun at peak hours.',
      uv !== null && uv >= 11.0,
    ),
  ]
})
</script>

<style scoped>
.sun-main {
  outline: none;
  padding: 24px;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  background:
    radial-gradient(circle at 15% 0%, rgba(255, 243, 224, 0.9), transparent 45%),
    radial-gradient(circle at 85% 10%, rgba(227, 242, 253, 0.9), transparent 40%),
    linear-gradient(180deg, #fffdf9 0%, #f7fbff 55%, #ffffff 100%);
  color: #1b2632;
  min-height: 100vh;
}

.sun-main > * {
  max-width: 980px;
  margin-left: auto;
  margin-right: auto;
}

h1 {
  font-size: 2.2rem;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
  color: #0f172a;
}

p {
  line-height: 1.6;
  color: #334155;
}

.feature-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(6px);
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}

input,
button {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #d7dee8;
  font-size: 0.95rem;
}

button {
  background: linear-gradient(135deg, #ffb25a 0%, #ff7a59 100%);
  color: #1b2632;
  border: none;
  font-weight: 600;
  box-shadow: 0 10px 22px rgba(255, 122, 89, 0.25);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(255, 122, 89, 0.35);
}

.result-box {
  background: linear-gradient(120deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 14px;
  padding: 10px;
  margin-top: 10px;
  margin-bottom: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.uv-warning {
  border-radius: 14px;
  padding: 12px;
  margin-top: 12px;
  border: 2px solid transparent;
  background: #f0f7f2;
  color: #1f2d1f;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.uv-warning-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.uv-warning-message {
  font-weight: 600;
  margin: 0 0 6px;
}

.uv-warning-detail {
  margin: 0;
}

.uv-warning--green {
  background: #e6f4ea;
  border-color: #2e7d32;
  color: #1b3b1d;
}

.uv-warning--yellow {
  background: #fff7d6;
  border-color: #f1c21b;
  color: #4b3b00;
}

.uv-warning--orange {
  background: #ffe6cc;
  border-color: #f57c00;
  color: #4a2c00;
}

.uv-warning--red {
  background: #fde7e9;
  border-color: #d32f2f;
  color: #4a1014;
}

.map-panel {
  margin-top: 16px;
  height: 280px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
}

.map-panel :deep(.map-wrapper) {
  height: 100% !important;
}

.advice-list {
  margin: 0;
  padding-left: 18px;
}

.uv-table {
  margin-top: 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  overflow: hidden;
  background: #ffffff;
}

.uv-table__header,
.uv-table__row {
  display: grid;
  grid-template-columns: minmax(160px, 210px) 1fr;
  gap: 12px;
  padding: 10px 12px;
  align-items: start;
}

.uv-table__header {
  background: #f8fafc;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.uv-table__row {
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  color: #334155;
}

.uv-table__row:last-child {
  border-bottom: none;
}

.uv-table__row--active {
  background: rgba(255, 210, 128, 0.35);
  box-shadow: inset 3px 0 0 #f59e0b;
  color: #4b2c00;
  font-weight: 600;
}

.uv-table__label {
  font-weight: 600;
  color: inherit;
}
</style>
