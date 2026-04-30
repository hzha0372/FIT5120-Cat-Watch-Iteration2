<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const CAT_TRACKER_BIRD_PREY_STAT =
  'Domestic cats were observed with bird prey in 59.1% of recorded prey events.'

const fileInput = ref(null)
const cameraVideo = ref(null)
const photoFile = ref(null)
const previewUrl = ref('')
const cameraOpen = ref(false)
const cameraError = ref('')
const cameraStream = ref(null)
const postcodeInput = ref('')
const selectedSuburb = ref(null)
const suburbSuggestions = ref([])
const suburbLoading = ref(false)
const speciesOptions = ref([])
const speciesSearch = ref('')
const speciesLoading = ref(false)
const selectedSpeciesKey = ref('')
const activePostcode = ref('')
const phase = ref('idle')
const errorMessage = ref('')
const identifyPayload = ref(null)
const confirmedSpecies = ref(null)
const confirmedInsight = ref(null)
const editableSpeciesName = ref('')
const saveStatus = ref('')
const saveError = ref('')
const savedSighting = ref(null)
const pendingAutoAnalyze = ref(false)
let suburbTimer = null
let speciesTimer = null

const topPrediction = computed(() => identifyPayload.value?.predictions?.[0] || null)
const possibleMatches = computed(() => (identifyPayload.value?.predictions || []).slice(0, 3))
const hasPhoto = computed(() => Boolean(photoFile.value && previewUrl.value))
const hasResult = computed(() => Boolean(identifyPayload.value))

const normalizeConfidence = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  if (n > 1) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

const confidenceValue = computed(() => normalizeConfidence(topPrediction.value?.confidence))
const confidencePct = computed(() => Math.round(confidenceValue.value * 100))
const resultTier = computed(() => {
  if (!topPrediction.value) return 'low'
  if (confidenceValue.value >= 0.6) return 'high'
  if (confidenceValue.value >= 0.3) return 'uncertain'
  return 'low'
})

const resultTone = computed(() => {
  if (resultTier.value === 'high') {
    return {
      label: 'AI Identified',
      className: 'tone-green',
    }
  }
  if (resultTier.value === 'uncertain') {
    return {
      label: 'Uncertain, please confirm',
      className: 'tone-yellow',
    }
  }
  return {
    label: 'Low Confidence',
    className: 'tone-red',
  }
})

const selectedSpecies = computed(
  () => speciesOptions.value.find((item) => item.id === selectedSpeciesKey.value) || null,
)

const speciesForDisplay = computed(() => {
  if (confirmedSpecies.value) return confirmedSpecies.value
  if (!topPrediction.value) return null
  return {
    commonName: topPrediction.value.common_name || '',
    scientificName: topPrediction.value.scientific_name || '',
  }
})

const displayInsight = computed(() => confirmedInsight.value)

const statusToneClass = computed(() => {
  const text = String(displayInsight.value?.conservationStatus || '').toLowerCase()
  if (text.includes('critical') || text.includes('endangered')) return 'status-red'
  if (text.includes('vulnerable')) return 'status-yellow'
  return 'status-green'
})

const showPredationWarning = computed(() => {
  const species = `${speciesForDisplay.value?.commonName || ''} ${speciesForDisplay.value?.scientificName || ''}`
    .toLowerCase()
    .trim()
  if (!species) return false
  return /(bird|duck|magpie|rosella|lorikeet|parrot|cockatoo|wagtail|raven|swallow|honeyeater|cormorant|egret|teal|dove|owl|eagle|hawk|falcon|wren|finch|lizard|skink|gecko|snake|python|turtle|reptile)/.test(
    species,
  )
})

const suburbLabel = (item) => {
  const postcode = String(item?.postcode || '').trim()
  const name = String(item?.name || '').trim()
  if (!postcode) return name
  if (!name || name.toLowerCase() === postcode.toLowerCase()) return postcode
  return `${postcode} ${name}`
}

const formatNumber = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString()
}

const formatConfidence = (value) => `${Math.round(normalizeConfidence(value) * 100)}%`

const normalizeInsight = (raw, fallbackSpecies = null) => {
  if (!raw) return null
  const prediction = raw.prediction || {}
  return {
    commonName:
      prediction.common_name ||
      prediction.commonName ||
      fallbackSpecies?.commonName ||
      speciesForDisplay.value?.commonName ||
      '',
    scientificName:
      prediction.scientific_name ||
      prediction.scientificName ||
      fallbackSpecies?.scientificName ||
      speciesForDisplay.value?.scientificName ||
      '',
    conservationStatus: raw.conservation_status || raw.conservationStatus || 'Not listed',
    localSightingCount: Number(raw.local_sighting_count || raw.localSightingCount || 0),
    lgaSightingCount: Number(raw.lga_sighting_count || raw.lgaSightingCount || 0),
    victoriaSightingCount: Number(raw.victoria_sighting_count || raw.victoriaSightingCount || 0),
    suburbName: raw.suburb_name || raw.suburbName || '',
    lgaName: raw.lga_name || raw.lgaName || '',
    location: raw.location || null,
    localPins: raw.local_pins || raw.localPins || [],
  }
}

const clearResult = () => {
  identifyPayload.value = null
  confirmedSpecies.value = null
  confirmedInsight.value = null
  editableSpeciesName.value = ''
  selectedSpeciesKey.value = ''
  saveStatus.value = ''
  saveError.value = ''
  savedSighting.value = null
}

const openUpload = () => fileInput.value?.click()
const stopCamera = () => {
  const stream = cameraStream.value
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
  }
  cameraStream.value = null
  if (cameraVideo.value) cameraVideo.value.srcObject = null
  cameraOpen.value = false
}

const openCamera = async () => {
  errorMessage.value = ''
  cameraError.value = ''

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Camera is not available in this browser.'
    cameraOpen.value = true
    return
  }

  try {
    stopCamera()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    cameraStream.value = stream
    cameraOpen.value = true
    await nextTick()
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = stream
      await cameraVideo.value.play()
    }
  } catch (error) {
    cameraOpen.value = true
    cameraError.value = error?.message || 'Unable to open camera.'
  }
}

const setPhotoFile = async (file) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  photoFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  phase.value = 'idle'
  clearResult()
  await nextTick()
  await analyzePhoto()
}

const captureCameraPhoto = async () => {
  const video = cameraVideo.value
  if (!video?.videoWidth || !video?.videoHeight) {
    cameraError.value = 'Camera is still starting. Please try again in a moment.'
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) {
    cameraError.value = 'Unable to capture the photo.'
    return
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) {
    cameraError.value = 'Unable to capture the photo.'
    return
  }

  const file = new File([blob], `catwatch-camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
  stopCamera()
  await setPhotoFile(file)
}

const handleFileChange = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  errorMessage.value = ''
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Please upload a JPG, PNG, or WEBP image.'
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    errorMessage.value = 'The image is larger than 10MB. Please upload a smaller photo.'
    return
  }

  await setPhotoFile(file)
}

const resetPhoto = () => {
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  photoFile.value = null
  phase.value = 'idle'
  errorMessage.value = ''
  pendingAutoAnalyze.value = false
  clearResult()
}

const loadSuburbSuggestions = async () => {
  const q = postcodeInput.value.trim()
  if (q.length < 2) {
    suburbSuggestions.value = []
    return
  }

  suburbLoading.value = true
  try {
    const response = await fetch(`/api/suburbs?q=${encodeURIComponent(q)}&limit=6`)
    const payload = await response.json()
    suburbSuggestions.value = payload?.results || []
  } catch {
    suburbSuggestions.value = []
  } finally {
    suburbLoading.value = false
  }
}

const chooseSuburb = (item) => {
  selectedSuburb.value = item
  postcodeInput.value = suburbLabel(item)
  activePostcode.value = item.postcode || ''
  suburbSuggestions.value = []
  errorMessage.value = ''
  if (pendingAutoAnalyze.value && photoFile.value && phase.value === 'idle') {
    pendingAutoAnalyze.value = false
    void analyzePhoto()
  }
}

const resolvePostcode = async () => {
  if (selectedSuburb.value?.postcode && postcodeInput.value === suburbLabel(selectedSuburb.value)) {
    activePostcode.value = selectedSuburb.value.postcode
    return selectedSuburb.value.postcode
  }

  const direct = String(postcodeInput.value || '').match(/\b(\d{4})\b/)?.[1] || ''
  if (direct) {
    activePostcode.value = direct
    return direct
  }

  const q = postcodeInput.value.trim()
  if (!q) throw new Error('Please enter a Victorian suburb or postcode.')

  const response = await fetch(`/api/suburbs?q=${encodeURIComponent(q)}&limit=1`)
  const payload = await response.json()
  const match = payload?.results?.[0]
  if (!response.ok || !match?.postcode) {
    throw new Error('Please select a Victorian suburb or enter a valid 4-digit postcode.')
  }

  chooseSuburb(match)
  return match.postcode
}

const loadSpeciesOptions = async () => {
  speciesLoading.value = true
  try {
    const response = await fetch(
      `/api/native-species?q=${encodeURIComponent(speciesSearch.value.trim())}&limit=160`,
    )
    const payload = await response.json()
    speciesOptions.value = payload?.results || []
  } catch {
    speciesOptions.value = []
  } finally {
    speciesLoading.value = false
  }
}

const loadInsightForSpecies = async (species) => {
  const postcode = activePostcode.value || (await resolvePostcode())
  const params = new URLSearchParams({
    postcode,
    scientificName: species.scientificName || '',
    commonName: species.commonName || '',
  })
  const response = await fetch(`/api/species-insights?${params.toString()}`)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || 'No database insight found for this species.')
  return normalizeInsight(payload, species)
}

const saveConfirmedSighting = async (species, insight, source) => {
  if (!species?.commonName || !species?.scientificName || !activePostcode.value) return
  saveStatus.value = 'saving'
  saveError.value = ''
  savedSighting.value = null

  try {
    const response = await fetch('/api/sighting-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postcode: activePostcode.value,
        commonName: species.commonName,
        scientificName: species.scientificName,
        confidence: confidencePct.value,
        lat: insight?.location?.lat,
        lng: insight?.location?.lng,
        source,
        photoFilename: photoFile.value?.name || '',
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Unable to save confirmed sighting.')
    savedSighting.value = payload.sighting || null
    saveStatus.value = 'saved'
  } catch (error) {
    saveStatus.value = 'error'
    saveError.value = error?.message || 'Unable to save confirmed sighting.'
  }
}

const analyzePhoto = async () => {
  errorMessage.value = ''
  clearResult()

  if (!photoFile.value) {
    errorMessage.value = 'Please take or upload a wildlife photo first.'
    return
  }

  let postcode = ''
  try {
    postcode = await resolvePostcode()
    pendingAutoAnalyze.value = false
  } catch (error) {
    pendingAutoAnalyze.value = true
    errorMessage.value = error?.message || 'Please enter Suburb or postcode before uploading.'
    return
  }

  phase.value = 'analyzing'
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)

  try {
    const formData = new FormData()
    formData.append('image', photoFile.value)
    formData.append('postcode', postcode)
    formData.append('top_k', '3')

    const response = await fetch('/api/epic3-identify', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Species identification failed.')

    identifyPayload.value = payload
    phase.value = 'result'

    const prediction = payload?.predictions?.[0]
    if (!prediction) return

    if (normalizeConfidence(prediction.confidence) >= 0.6) {
      const species = {
        commonName: prediction.common_name || '',
        scientificName: prediction.scientific_name || '',
      }
      confirmedSpecies.value = species
      editableSpeciesName.value = species.commonName
      try {
        confirmedInsight.value = await loadInsightForSpecies(species)
      } catch {
        confirmedInsight.value = normalizeInsight(payload?.species_insights?.[0], species)
      }
      await saveConfirmedSighting(species, confirmedInsight.value, 'ai-identified')
    }
  } catch (error) {
    phase.value = 'idle'
    if (error?.name === 'AbortError') {
      errorMessage.value = 'Identification took longer than 5 seconds. Please try again with a clearer photo.'
    } else {
      errorMessage.value = error?.message || 'Species identification failed.'
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

const confirmManualSpecies = async () => {
  const selected = selectedSpecies.value
  if (!selected) {
    errorMessage.value = 'Please choose a Victorian native species from the dropdown.'
    return
  }

  const species = {
    commonName: selected.commonName,
    scientificName: selected.scientificName,
  }

  errorMessage.value = ''
  confirmedSpecies.value = species
  editableSpeciesName.value = species.commonName
  saveStatus.value = ''
  saveError.value = ''

  try {
    confirmedInsight.value = await loadInsightForSpecies(species)
    await saveConfirmedSighting(species, confirmedInsight.value, 'manual-confirmation')
  } catch (error) {
    errorMessage.value = error?.message || 'No database insight found for this species.'
  }
}

watch(postcodeInput, () => {
  if (!selectedSuburb.value || postcodeInput.value !== suburbLabel(selectedSuburb.value)) {
    selectedSuburb.value = null
    activePostcode.value = ''
  }

  if (suburbTimer) window.clearTimeout(suburbTimer)
  suburbTimer = window.setTimeout(loadSuburbSuggestions, 180)

  if (
    pendingAutoAnalyze.value &&
    photoFile.value &&
    phase.value === 'idle' &&
    /\b\d{4}\b/.test(postcodeInput.value)
  ) {
    pendingAutoAnalyze.value = false
    window.setTimeout(() => void analyzePhoto(), 220)
  }
})

watch(speciesSearch, () => {
  if (speciesTimer) window.clearTimeout(speciesTimer)
  speciesTimer = window.setTimeout(loadSpeciesOptions, 180)
})

onMounted(loadSpeciesOptions)

onUnmounted(() => {
  if (suburbTimer) window.clearTimeout(suburbTimer)
  if (speciesTimer) window.clearTimeout(speciesTimer)
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <main class="identifier-page">
    <div class="identifier-container">
      <header class="identifier-hero">
        <span class="hero-camera" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 8l1.6-2h4.8L16 8h2.5A2.5 2.5 0 0 1 21 10.5v6A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8H8Z" />
            <circle cx="12" cy="13.5" r="3.1" />
          </svg>
        </span>
        <h1>AI Wildlife Species Identifier</h1>
        <p>Upload a photo of wildlife and get instant AI-powered species identification</p>
      </header>

      <section class="api-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v7" />
          <path d="M12 7h.01" />
        </svg>
        <div>
          <h2>Powered by iNaturalist Computer Vision API</h2>
          <p>
            Our AI is trained on millions of verified wildlife observations. Upload a clear
            photo of a bird, feather, reptile, or other wildlife for best results.
          </p>
        </div>
      </section>

      <section class="location-card">
        <label class="location-field">
          <span>Suburb or postcode</span>
          <input
            v-model="postcodeInput"
            inputmode="search"
            autocomplete="off"
            placeholder="Suburb or postcode"
          />
        </label>
        <ul v-if="suburbSuggestions.length" class="suggestion-list">
          <li v-for="item in suburbSuggestions" :key="item.id" @click="chooseSuburb(item)">
            {{ suburbLabel(item) }}
          </li>
        </ul>
        <small v-if="suburbLoading">Searching database suburbs...</small>
      </section>

      <section v-if="cameraOpen" class="camera-card">
        <header>
          <h2>Take Photo</h2>
          <button type="button" @click="stopCamera">Cancel</button>
        </header>
        <div class="camera-frame">
          <video ref="cameraVideo" autoplay muted playsinline />
          <p v-if="cameraError">{{ cameraError }}</p>
        </div>
        <button type="button" class="take-button" :disabled="Boolean(cameraError)" @click="captureCameraPhoto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Capture Photo
        </button>
      </section>

      <section v-else-if="!hasPhoto" class="upload-drop">
        <div class="upload-icons" aria-hidden="true">
          <button type="button" class="icon-button camera-icon" @click="openCamera">
            <svg viewBox="0 0 24 24">
              <path d="M8 8l1.6-2h4.8L16 8h2.5A2.5 2.5 0 0 1 21 10.5v6A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8H8Z" />
              <circle cx="12" cy="13.5" r="3.1" />
            </svg>
          </button>
          <button type="button" class="icon-button upload-icon" @click="openUpload">
            <svg viewBox="0 0 24 24">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
        <h2>Upload Wildlife Photo</h2>
        <p>Take a photo with your camera or upload an existing image</p>
        <div class="upload-actions">
          <button type="button" class="take-button" @click="openCamera">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 8l1.6-2h4.8L16 8h2.5A2.5 2.5 0 0 1 21 10.5v6A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8H8Z" />
              <circle cx="12" cy="13.5" r="3.1" />
            </svg>
            Take Photo
          </button>
          <button type="button" class="file-button" @click="openUpload">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
            Upload File
          </button>
        </div>
        <small>Supported formats: JPG, PNG, WEBP • Max size: 10MB</small>
      </section>

      <section v-else class="uploaded-card">
        <header>
          <h2>Uploaded Image</h2>
          <button type="button" @click="resetPhoto">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.2 6.5" />
              <path d="M3 12A9 9 0 0 1 18.2 5.5" />
              <path d="M18 2v4h4" />
              <path d="M6 22v-4H2" />
            </svg>
            New Photo
          </button>
        </header>
        <div class="photo-preview">
          <img :src="previewUrl" alt="Uploaded wildlife preview" />
        </div>
      </section>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

      <section v-if="phase === 'analyzing'" class="analyzing-card">
        <div class="spinner" aria-hidden="true" />
        <h2>Analyzing Image...</h2>
        <p>AI is identifying species • Usually takes 2-5 seconds</p>
      </section>

      <section v-if="hasResult" class="results-card">
        <header>
          <h2>Identification Results</h2>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 10v7" />
            <path d="M12 7h.01" />
          </svg>
        </header>

        <div class="confidence-pill" :class="resultTone.className">
          <svg v-if="resultTier === 'high'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 16h.01" />
          </svg>
          <span>{{ resultTone.label }}</span>
          <strong>{{ confidencePct }}%</strong>
        </div>

        <h3>Species Identification</h3>

        <section v-if="resultTier === 'low'" class="low-panel">
          <div class="low-heading">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6" />
              <path d="M12 16h.01" />
            </svg>
            <h4>Low Confidence Result</h4>
          </div>
          <p>
            The image quality may be too low for accurate identification. Please retake with:
          </p>
          <ul>
            <li>Better lighting (natural daylight works best)</li>
            <li>Closer focus on the subject</li>
            <li>Clearer view of distinctive features</li>
            <li>Different angle if current view is obscured</li>
          </ul>
          <div v-if="possibleMatches.length" class="possible-matches">
            <p>Top possible matches for reference</p>
            <span v-for="match in possibleMatches" :key="`${match.scientific_name}-${match.confidence}`">
              {{ match.common_name || match.scientific_name }} · {{ formatConfidence(match.confidence) }}
            </span>
          </div>
          <button type="button" @click="resetPhoto">Upload New Photo</button>
        </section>

        <template v-else>
          <section v-if="resultTier === 'uncertain' && !confirmedSpecies" class="confirm-panel">
            <p>
              AI suggestion:
              <strong>{{ topPrediction?.common_name || topPrediction?.scientific_name }}</strong>
            </p>
            <label>
              <span>Confirm Victorian native species</span>
              <input
                v-model="speciesSearch"
                autocomplete="off"
                placeholder="Search species from database"
              />
            </label>
            <select v-model="selectedSpeciesKey">
              <option value="">Select species</option>
              <option v-for="item in speciesOptions" :key="item.id" :value="item.id">
                {{ item.commonName }} - {{ item.scientificName }}
              </option>
            </select>
            <small v-if="speciesLoading">Loading species from species_cache...</small>
            <button type="button" @click="confirmManualSpecies">Confirm Species</button>
          </section>

          <label v-if="confirmedSpecies" class="species-field" :class="resultTone.className">
            <input v-model="editableSpeciesName" aria-label="Editable species name" />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </label>

          <section v-if="displayInsight" class="detail-grid">
            <article>
              <p>Scientific Name</p>
              <strong><em>{{ displayInsight.scientificName }}</em></strong>
            </article>
            <article>
              <p>
                Conservation Status
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 10v7" />
                  <path d="M12 7h.01" />
                </svg>
              </p>
              <strong class="status-badge" :class="statusToneClass">
                <span />
                {{ displayInsight.conservationStatus }}
              </strong>
            </article>
          </section>

          <section v-if="displayInsight" class="local-data">
            <h4>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10v7" />
                <path d="M12 7h.01" />
              </svg>
              Local Sightings Data
            </h4>
            <p>
              This species has been recorded
              <strong>{{ formatNumber(displayInsight.localSightingCount) }} times</strong>
              within 5km of postcode {{ activePostcode }}<span v-if="displayInsight.suburbName">
                ({{ displayInsight.suburbName }})</span
              >.
            </p>
            <p class="muted-counts">
              {{ formatNumber(displayInsight.lgaSightingCount) }} records in
              {{ displayInsight.lgaName || 'the local LGA' }} ·
              {{ formatNumber(displayInsight.victoriaSightingCount) }} records across Victoria
            </p>
          </section>

          <section v-if="displayInsight && showPredationWarning" class="cat-risk">
            <h4>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6" />
                <path d="M12 16h.01" />
              </svg>
              Cat Predation Risk
            </h4>
            <p>
              According to <strong>Cat Tracker SA research</strong>:
              {{ CAT_TRACKER_BIRD_PREY_STAT }} This species is at significant risk from roaming
              domestic cats.
            </p>
          </section>

          <section v-if="saveStatus" class="community-pin" :class="saveStatus">
            <div class="pin-map" aria-hidden="true">
              <span />
            </div>
            <div>
              <h4>Community Map</h4>
              <p v-if="saveStatus === 'saving'">Saving confirmed sighting to the database...</p>
              <p v-else-if="saveStatus === 'saved'">
                Confirmed sighting saved as a blue community pin for postcode
                {{ savedSighting?.postcode || activePostcode }}.
              </p>
              <p v-else>{{ saveError }}</p>
            </div>
          </section>
        </template>
      </section>

      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        @change="handleFileChange"
      />
    </div>
  </main>
</template>

<style scoped>
.identifier-page {
  min-height: calc(100dvh - 101px);
  background:
    radial-gradient(circle at 50% -10%, rgba(224, 236, 255, 0.92), transparent 34rem),
    linear-gradient(180deg, #f6f8ff 0%, #fff9ff 100%);
  color: #0f172a;
  padding: 34px 16px 56px;
}

.identifier-container {
  width: min(100%, 1180px);
  margin: 0 auto;
}

.identifier-hero {
  text-align: center;
}

.hero-camera {
  display: inline-grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #8ea4ff, #b272ff);
  color: #ffffff;
}

svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hero-camera svg {
  width: 28px;
  height: 28px;
}

.identifier-hero h1 {
  margin: 16px 0 0;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 900;
  line-height: 1.05;
  background: linear-gradient(90deg, #315cff, #9519ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.identifier-hero p {
  margin: 12px auto 0;
  max-width: 920px;
  color: #4b5563;
  font-size: clamp(1rem, 1.7vw, 1.18rem);
  font-weight: 650;
}

.api-note {
  margin: 34px 0 24px;
  display: flex;
  gap: 18px;
  align-items: flex-start;
  border: 3px solid #ead2ff;
  border-radius: 20px;
  background: linear-gradient(90deg, rgba(239, 247, 255, 0.82), rgba(255, 247, 255, 0.9));
  padding: 18px 22px;
  color: #6816b8;
}

.api-note > svg {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  color: #8c19ff;
}

.api-note h2 {
  margin: 0;
  font-size: 1.04rem;
  font-weight: 900;
}

.api-note p {
  margin: 8px 0 0;
  color: #6d20c6;
  font-size: 0.98rem;
  line-height: 1.45;
}

.location-card {
  position: relative;
  margin-bottom: 22px;
  border: 2px solid #ead2ff;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  padding: 16px;
}

.location-field {
  display: grid;
  gap: 10px;
}

.location-field span,
.confirm-panel label span {
  color: #374151;
  font-size: 0.98rem;
  font-weight: 850;
}

.location-field input,
.confirm-panel input,
.confirm-panel select,
.species-field input {
  width: 100%;
  min-height: 48px;
  border: 2px solid #e9d5ff;
  border-radius: 14px;
  background: #ffffff;
  color: #111827;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  padding: 0 18px;
  outline: none;
}

.location-field input:focus,
.confirm-panel input:focus,
.confirm-panel select:focus,
.species-field input:focus {
  border-color: #9b1cff;
  box-shadow: 0 0 0 4px rgba(155, 28, 255, 0.12);
}

.suggestion-list {
  position: absolute;
  z-index: 20;
  top: calc(100% - 14px);
  left: 16px;
  right: 16px;
  margin: 0;
  padding: 8px;
  list-style: none;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
}

.suggestion-list li {
  border-radius: 12px;
  padding: 13px 14px;
  color: #374151;
  font-weight: 800;
  cursor: pointer;
}

.suggestion-list li:hover {
  background: #e8f8ef;
  color: #047857;
}

.location-card small {
  display: block;
  margin-top: 10px;
  color: #6b7280;
  font-weight: 700;
}

.upload-drop {
  min-height: 390px;
  display: grid;
  place-items: center;
  justify-items: center;
  text-align: center;
  border: 5px dashed #ead2ff;
  border-radius: 28px;
  background: #ffffff;
  padding: 38px 20px;
}

.upload-icons {
  display: flex;
  gap: 28px;
}

.icon-button {
  display: grid;
  width: 82px;
  height: 82px;
  place-items: center;
  border: 0;
  border-radius: 20px;
  cursor: pointer;
}

.icon-button svg {
  width: 36px;
  height: 36px;
  stroke-width: 2.6;
}

.camera-icon {
  background: #d8e9ff;
  color: #2563eb;
}

.upload-icon {
  background: #f1ddff;
  color: #9519ff;
}

.upload-drop h2 {
  margin: 24px 0 0;
  color: #0f172a;
  font-size: clamp(1.7rem, 3vw, 2.3rem);
  line-height: 1.08;
  font-weight: 900;
}

.upload-drop p {
  max-width: 520px;
  margin: 12px 0 0;
  color: #4b5563;
  font-size: 1.08rem;
  font-weight: 650;
}

.upload-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 22px;
  margin-top: 24px;
}

.take-button,
.file-button,
.identify-button,
.confirm-panel button,
.low-panel button {
  display: inline-flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border-radius: 18px;
  padding: 0 34px;
  border: 3px solid transparent;
  font: inherit;
  font-size: 1rem;
  font-weight: 900;
  cursor: pointer;
}

.take-button,
.identify-button {
  color: #ffffff;
  background: linear-gradient(90deg, #2f5eff, #9b16ff);
}

.file-button {
  color: #9b16ff;
  background: #ffffff;
  border-color: #ead2ff;
}

.take-button svg,
.file-button svg {
  width: 24px;
  height: 24px;
}

.upload-drop small {
  display: block;
  margin-top: 18px;
  color: #6b7280;
  font-size: 0.95rem;
  font-weight: 750;
}

.uploaded-card,
.results-card,
.camera-card,
.analyzing-card {
  overflow: hidden;
  border: 2px solid #e5e7eb;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.uploaded-card header {
  min-height: 86px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(90deg, rgba(252, 247, 255, 0.92), rgba(239, 247, 255, 0.92));
  padding: 20px 26px;
}

.uploaded-card h2,
.results-card > header h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(1.55rem, 3vw, 2.15rem);
  line-height: 1.1;
  font-weight: 900;
}

.uploaded-card header button {
  display: inline-flex;
  min-height: 58px;
  align-items: center;
  gap: 12px;
  border: 2px solid #d1d5db;
  border-radius: 16px;
  background: #ffffff;
  color: #374151;
  font: inherit;
  font-size: 1.08rem;
  font-weight: 850;
  padding: 0 22px;
  cursor: pointer;
}

.uploaded-card header svg {
  width: 24px;
  height: 24px;
}

.camera-card {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.camera-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.camera-card h2 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 900;
}

.camera-card header button {
  min-height: 44px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  color: #374151;
  font: inherit;
  font-weight: 850;
  padding: 0 18px;
  cursor: pointer;
}

.camera-frame {
  display: grid;
  min-height: 380px;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background: #0f172a;
}

.camera-frame video {
  width: 100%;
  max-height: 560px;
  object-fit: contain;
}

.camera-frame p {
  color: #ffffff;
  font-weight: 800;
}

.camera-card > .take-button {
  justify-self: center;
}

.take-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.photo-preview {
  display: grid;
  min-height: 340px;
  place-items: center;
  background: #ffffff;
  padding: 32px;
}

.photo-preview img {
  width: min(100%, 420px);
  max-height: 440px;
  border-radius: 10px;
  object-fit: contain;
  background: #f8fafc;
}

.error-message {
  margin: 22px 0 0;
  border: 2px solid #fecaca;
  border-radius: 16px;
  background: #fff1f2;
  color: #b91c1c;
  padding: 16px 18px;
  font-weight: 850;
}

.analyzing-card {
  margin-top: 28px;
  display: grid;
  min-height: 240px;
  place-items: center;
  justify-items: center;
  border-color: #ead2ff;
  padding: 44px 24px;
}

.spinner {
  width: 78px;
  height: 78px;
  border: 8px solid #f1ddff;
  border-top-color: #9519ff;
  border-radius: 50%;
  animation: spin 850ms linear infinite;
}

.analyzing-card h2 {
  margin: 18px 0 0;
  color: #0f172a;
  font-size: 1.75rem;
  font-weight: 900;
}

.analyzing-card p {
  margin: 8px 0 0;
  color: #4b5563;
  font-size: 1.1rem;
  font-weight: 650;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.results-card {
  margin-top: 28px;
  padding: 30px;
}

.results-card > header {
  display: flex;
  align-items: center;
  gap: 18px;
}

.results-card > header svg {
  width: 28px;
  height: 28px;
  color: #9ca3af;
}

.confidence-pill {
  width: max-content;
  max-width: 100%;
  min-height: 58px;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  border: 3px solid currentColor;
  border-radius: 20px;
  margin-top: 30px;
  padding: 0 22px;
  font-size: 1.08rem;
  font-weight: 900;
}

.confidence-pill svg {
  width: 24px;
  height: 24px;
}

.confidence-pill strong {
  font-size: 1.8rem;
  line-height: 1;
}

.tone-green {
  color: #00883e;
  background: #dcfce7;
}

.tone-yellow {
  color: #a16207;
  background: #fef9c3;
}

.tone-red {
  color: #c40011;
  background: #fee2e2;
}

.results-card h3 {
  margin: 34px 0 16px;
  color: #374151;
  font-size: 1.32rem;
  line-height: 1.15;
  font-weight: 900;
}

.low-panel,
.cat-risk {
  border: 3px solid #ff9da3;
  border-radius: 22px;
  background: #fff1f2;
  color: #a1000b;
  padding: 26px 30px;
}

.low-heading,
.cat-risk h4,
.local-data h4 {
  display: flex;
  align-items: center;
  gap: 18px;
}

.low-heading svg,
.cat-risk svg,
.local-data svg {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
}

.low-panel h4,
.cat-risk h4,
.local-data h4 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.15;
  font-weight: 900;
}

.low-panel p,
.cat-risk p,
.local-data p {
  margin: 20px 0 0;
  font-size: 1.05rem;
  line-height: 1.55;
}

.low-panel ul {
  margin: 18px 0 0;
  padding-left: 26px;
  font-size: 1rem;
  line-height: 1.75;
}

.possible-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.possible-matches p {
  flex-basis: 100%;
  margin: 0;
  font-weight: 900;
}

.possible-matches span {
  border-radius: 999px;
  background: #ffffff;
  padding: 10px 14px;
  font-weight: 800;
}

.low-panel button {
  margin-top: 22px;
  background: #ef0012;
  color: #ffffff;
}

.confirm-panel {
  display: grid;
  gap: 14px;
  border: 3px solid #fde68a;
  border-radius: 22px;
  background: #fffbeb;
  padding: 22px;
}

.confirm-panel p {
  margin: 0;
  color: #713f12;
  font-size: 1rem;
  font-weight: 800;
}

.confirm-panel label {
  display: grid;
  gap: 10px;
}

.confirm-panel button {
  width: max-content;
  color: #ffffff;
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.confirm-panel small {
  color: #713f12;
  font-weight: 800;
}

.species-field {
  min-height: 68px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 3px solid currentColor;
  border-radius: 20px;
  padding: 0 22px;
}

.species-field input {
  min-height: 58px;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: #111827;
  font-size: 1.15rem;
  font-weight: 900;
  padding: 0;
}

.species-field svg {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.detail-grid article {
  min-height: 112px;
  border-radius: 22px;
  background: #f8fafc;
  padding: 24px;
}

.detail-grid p {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: #4b5563;
  font-size: 1rem;
  font-weight: 850;
}

.detail-grid p svg {
  width: 22px;
  height: 22px;
  color: #9ca3af;
}

.detail-grid strong {
  display: flex;
  align-items: center;
  margin-top: 14px;
  color: #0f172a;
  font-size: 1.32rem;
  line-height: 1.2;
  font-weight: 900;
}

.status-badge {
  gap: 18px;
}

.status-badge span {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: currentColor;
}

.status-green {
  color: #00c853;
}

.status-yellow {
  color: #f59e0b;
}

.status-red {
  color: #ef0012;
}

.local-data {
  margin-top: 30px;
  border: 3px solid #bfdbfe;
  border-radius: 22px;
  background: #eff6ff;
  color: #1e40af;
  padding: 26px;
}

.local-data h4 {
  color: #1e3a8a;
}

.local-data strong {
  font-weight: 900;
}

.muted-counts {
  color: #2f57c4;
  font-size: 0.95rem !important;
  font-weight: 750;
}

.cat-risk {
  margin-top: 30px;
}

.community-pin {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: center;
  margin-top: 30px;
  border: 3px solid #bfdbfe;
  border-radius: 22px;
  background: #f8fbff;
  padding: 24px;
}

.pin-map {
  position: relative;
  min-height: 120px;
  overflow: hidden;
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    #eff6ff;
  background-size: 28px 28px;
}

.pin-map span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 24px;
  height: 24px;
  border: 4px solid #ffffff;
  border-radius: 50% 50% 50% 0;
  background: #2563eb;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
  transform: translate(-50%, -50%) rotate(-45deg);
}

.community-pin h4 {
  margin: 0;
  color: #1e3a8a;
  font-size: 1.2rem;
  font-weight: 900;
}

.community-pin p {
  margin: 10px 0 0;
  color: #1e40af;
  font-size: 0.98rem;
  font-weight: 750;
}

.community-pin.error {
  border-color: #fecaca;
  background: #fff1f2;
}

.community-pin.error h4,
.community-pin.error p {
  color: #b91c1c;
}

.hidden-input {
  display: none;
}

@media (max-width: 860px) {
  .api-note,
  .uploaded-card header,
  .community-pin {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .results-card {
    padding: 28px;
  }

  .upload-drop {
    min-height: 460px;
  }
}

@media (max-width: 560px) {
  .identifier-page {
    padding: 32px 12px 56px;
  }

  .api-note,
  .location-card,
  .low-panel,
  .cat-risk,
  .local-data {
    padding: 22px;
  }

  .upload-icons {
    gap: 16px;
  }

  .icon-button {
    width: 88px;
    height: 88px;
  }

  .take-button,
  .file-button,
  .identify-button,
  .confirm-panel button,
  .low-panel button {
    width: 100%;
    padding: 0 22px;
  }

  .confidence-pill {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
    padding: 18px;
  }

  .photo-preview {
    min-height: 320px;
    padding: 18px;
  }
}
</style>
