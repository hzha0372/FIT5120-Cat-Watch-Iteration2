<template>
  <main style="padding: 20px">
    <h1 id="sun-header">Sun Safety Dashboard</h1>
    <p>
      This page provides UV tracking and clothing guidance based on your location to reduce
      sunburn risk.
    </p>

    <section class="feature-card" aria-labelledby="uv-tracking-title">
      <h2 id="uv-tracking-title">Location Based UV Levels</h2>
      <p>
        Enable location access or enter a postcode to view the current UV index and risk category.
      </p>

      <div class="control-row">
        <button @click="useCurrentLocation" :disabled="loading">Use My Location</button>
        <span>or</span>
        <input
          v-model.trim="postcode"
          type="text"
          inputmode="numeric"
          maxlength="4"
          placeholder="Enter postcode"
          aria-label="Enter postcode"
        />
        <button @click="searchByPostcode" :disabled="loading || !postcode">Check UV</button>
      </div>

      <p v-if="loading">Loading UV data...</p>
      <p v-else-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <div v-if="uvResult" class="result-box">
        <p><strong>Location:</strong> {{ uvResult.locationName }}</p>
        <p><strong>Current UV Index:</strong> {{ uvResult.uvIndex.toFixed(1) }}</p>
        <p><strong>Risk Level:</strong> {{ uvResult.riskLevel }}</p>
      </div>
    </section>

    <section class="feature-card" aria-labelledby="clothing-title">
      <h2 id="clothing-title">Choice of Clothes</h2>
      <p>When UV is 3 or above, choose your clothing to get protection suggestions.</p>

      <div class="control-row">
        <label for="clothing-choice">Choice of clothes:</label>
        <select id="clothing-choice" v-model="clothingChoice">
          <option disabled value="">Select</option>
          <option>Short-sleeve shirt</option>
          <option>Long-sleeve shirt</option>
          <option>Tank top</option>
          <option>Rash vest</option>
          <option>Hat</option>
          <option>No hat</option>
        </select>
      </div>

      <ul v-if="clothingAdvice.length" class="advice-list">
        <li v-for="advice in clothingAdvice" :key="advice">{{ advice }}</li>
      </ul>
      <p v-else>Select a clothing option after checking UV levels.</p>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'

const postcode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const clothingChoice = ref('')
const uvResult = ref(null)

const uvRiskLevel = (value) => {
  if (value <= 2) return 'Low (0-2)'
  if (value <= 5) return 'Moderate (3-5)'
  if (value <= 7) return 'High (6-7)'
  if (value <= 10) return 'Very High (8-10)'
  return 'Extreme (11+)'
}

const fetchUvForCoordinates = async (latitude, longitude, locationName) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=uv_index`
    )
    const data = await response.json()
    const uvIndex = data?.current?.uv_index

    if (typeof uvIndex !== 'number') {
      throw new Error('Unable to fetch UV index for this location.')
    }

    uvResult.value = {
      locationName,
      uvIndex,
      riskLevel: uvRiskLevel(uvIndex),
    }
  } catch (error) {
    uvResult.value = null
    errorMessage.value = error.message || 'Failed to load UV information.'
  } finally {
    loading.value = false
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
    async (position) => {
      const { latitude, longitude } = position.coords
      await fetchUvForCoordinates(latitude, longitude, 'Your current location')
    },
    () => {
      loading.value = false
      errorMessage.value = 'Location access was blocked. Please enter a postcode instead.'
    }
  )
}

const searchByPostcode = async () => {
  if (!/^\d{4}$/.test(postcode.value)) {
    errorMessage.value = 'Please enter a valid 4-digit Australian postcode.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${postcode.value}&country=AU&count=1`
    )
    const geoData = await geoResponse.json()
    const result = geoData?.results?.[0]

    if (!result) {
      throw new Error('Postcode not found. Please try another postcode.')
    }

    await fetchUvForCoordinates(result.latitude, result.longitude, `${result.name}, ${result.admin1}`)
  } catch (error) {
    loading.value = false
    uvResult.value = null
    errorMessage.value = error.message || 'Could not look up postcode.'
  }
}

const clothingAdvice = computed(() => {
  if (!uvResult.value || uvResult.value.uvIndex < 3 || !clothingChoice.value) {
    return []
  }

  const suggestions = [
    'UV is 3+, reduce direct sun exposure especially between 10am and 4pm.',
    'Prefer shade options during peak UV hours.',
  ]

  if (clothingChoice.value === 'Short-sleeve shirt' || clothingChoice.value === 'Tank top') {
    suggestions.push('Switch to a long-sleeve shirt or add a rash vest for better coverage.')
  }

  if (clothingChoice.value === 'No hat') {
    suggestions.push('Add a broad-brim hat to protect your face, neck and ears.')
  }

  if (clothingChoice.value === 'Long-sleeve shirt' || clothingChoice.value === 'Rash vest') {
    suggestions.push('Great choice. Pair this with SPF 50+ sunscreen and sunglasses.')
  }

  if (clothingChoice.value === 'Hat') {
    suggestions.push('Good start. Also wear protective clothing like a long-sleeve top.')
  }

  return suggestions
})
</script>

<style scoped>
main {
  outline: none;
}

.feature-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}

input,
select,
button {
  padding: 6px 8px;
}

.result-box {
  background: #f8f8f8;
  border-radius: 6px;
  padding: 10px;
  margin-top: 10px;
}
</style>
