<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ProtectedLoginPanel from '../components/ProtectedLoginPanel.vue'
import { isAuthenticated } from '../utils/auth'

const postcodeInput = ref('')
const selectedSuggestion = ref(null)
const suggestions = ref([])
const lookupLoading = ref(false)
const loading = ref(false)
const error = ref('')
const data = ref(null)
const formulaLoading = ref(false)
const formulaError = ref('')
const formulaData = ref(null)
let lookupTimer = null
const authed = ref(isAuthenticated())

const normalizePostcode = (value) => String(value || '').match(/\d{4}/)?.[0] || ''
const scoreDisplay = computed(() => Math.round(Number(data.value?.score?.total || 0)))
const location = computed(() => data.value?.location || null)
const components = computed(() => data.value?.components || [])
const rankingRows = computed(() => data.value?.ranking?.rows || [])
const scoreRiskKey = computed(() => data.value?.score?.risk?.key || 'lower')
const riskClass = (key) => `risk-${key || 'lower'}`
const formulaComponents = computed(() => formulaData.value?.components || [])

// Risk bands are display rules for the score returned by /api/cat-impact-score.
// The score itself is not calculated here; Vue only maps the API value to a CSS
// class so high/medium/lower results keep the original visual language.
const riskKeyForScore = (score) => {
  const value = Number(score)
  if (value > 70) return 'high'
  if (value >= 40) return 'medium'
  return 'lower'
}

const componentToneClass = (component) => {
  if (component?.key === 'containmentGap') return 'component-red'
  if (component?.key === 'wildlifeDensity') return 'component-blue'
  if (component?.key === 'roamingCatDensity') return 'component-yellow'
  return 'component-blue'
}

// Load the formula block from the API instead of keeping the displayed weights
// in the Vue component. The API verifies database score rows first, so the
// intro section cannot silently show disconnected or invented component values.
const fetchImpactFormula = async () => {
  formulaLoading.value = true
  formulaError.value = ''
  try {
    const response = await fetch('/api/impact-formula')
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load score formula.')
    formulaData.value = payload
  } catch (err) {
    formulaError.value = err?.message || 'Failed to load score formula.'
    formulaData.value = null
  } finally {
    formulaLoading.value = false
  }
}

const suggestionLabel = (item) => {
  const postcode = String(item?.postcode || '').trim()
  const name = String(item?.name || '').trim()
  if (!postcode) return name
  if (!name || name.toLowerCase() === postcode.toLowerCase()) return postcode
  return [postcode, name].filter(Boolean).join(' ')
}

// Search suggestions come from suburb_demographics through /api/suburbs. The
// component stores only the selected row and postcode; the actual score is
// requested from /api/cat-impact-score after submit.
const lookupSuburbs = async () => {
  const q = postcodeInput.value.trim()
  if (q.length < 2) {
    suggestions.value = []
    return
  }

  lookupLoading.value = true
  try {
    const response = await fetch(`/api/suburbs?q=${encodeURIComponent(q)}&limit=6`)
    const payload = await response.json()
    suggestions.value = payload?.results || []
  } catch {
    suggestions.value = []
  } finally {
    lookupLoading.value = false
  }
}

const chooseSuggestion = (item) => {
  selectedSuggestion.value = item
  postcodeInput.value = suggestionLabel(item)
  suggestions.value = []
  error.value = ''
}

const resolvePostcode = async () => {
  if (selectedSuggestion.value?.postcode && postcodeInput.value === suggestionLabel(selectedSuggestion.value)) {
    return selectedSuggestion.value.postcode
  }

  const direct = normalizePostcode(postcodeInput.value)
  if (direct) return direct

  const response = await fetch(`/api/suburbs?q=${encodeURIComponent(postcodeInput.value.trim())}&limit=1`)
  const payload = await response.json()
  if (!response.ok || !payload?.results?.[0]?.postcode) {
    throw new Error('Please enter a valid Victorian suburb or postcode.')
  }
  const match = payload.results[0]
  postcodeInput.value = suggestionLabel(match)
  selectedSuggestion.value = match
  return match.postcode
}

// Submit is the only path that loads score data. It clears stale suggestions,
// resolves text input to a database postcode, then replaces the whole result
// payload with the API response so no previous suburb data can linger.
const submitPostcode = async () => {
  if (!postcodeInput.value.trim()) {
    error.value = 'Please enter a Victorian suburb or postcode.'
    return
  }

  if (lookupTimer) clearTimeout(lookupTimer)
  suggestions.value = []
  loading.value = true
  error.value = ''
  try {
    const postcode = await resolvePostcode()
    const response = await fetch(`/api/cat-impact-score?postcode=${encodeURIComponent(postcode)}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load Cat Impact Score.')
    data.value = payload
  } catch (err) {
    data.value = null
    error.value = err?.message || 'Failed to load Cat Impact Score.'
  } finally {
    loading.value = false
  }
}

watch(postcodeInput, () => {
  if (!selectedSuggestion.value || postcodeInput.value !== suggestionLabel(selectedSuggestion.value)) {
    selectedSuggestion.value = null
  }
  if (lookupTimer) clearTimeout(lookupTimer)
  lookupTimer = setTimeout(lookupSuburbs, 180)
})

onMounted(fetchImpactFormula)
</script>

<template>
  <main class="impact-prototype cw-page">
    <div class="cw-container-narrow">
      <header class="impact-header cw-text-center">
        <h1 class="cw-page-title">Impact Score Calculator</h1>
        <p class="cw-page-subtitle">
          Enter your suburb or postcode to discover the environmental impact score for your area
        </p>
      </header>

      <ProtectedLoginPanel
        v-if="!authed"
        title="Login to Access Impact Score"
        subtitle="Please sign in to view and calculate Impact Score."
        @success="authed = true"
      />

      <template v-else>

      <form class="calculator-card cw-card" aria-label="Impact score postcode search" @submit.prevent="submitPostcode">
        <label class="search-field">
          <span aria-hidden="true">⌖</span>
          <input
            v-model="postcodeInput"
            inputmode="search"
            autocomplete="off"
            placeholder="Enter your suburb or postcode"
          />
          <ul v-if="suggestions.length" class="suggestions">
            <li v-for="item in suggestions" :key="item.id" @click="chooseSuggestion(item)">
              <strong>{{ suggestionLabel(item) }}</strong>
            </li>
          </ul>
          <small v-if="lookupLoading" class="lookup-status">Searching...</small>
        </label>
        <button type="submit" :disabled="loading">
          <span aria-hidden="true">⌕</span>
          {{ loading ? 'Loading...' : 'Calculate' }}
        </button>
      </form>

      <p v-if="error" class="error-line">{{ error }}</p>

      <!-- Intro uses /api/impact-formula so displayed weights are not stored in this view. -->
      <section v-if="!data" class="component-intro">
        <p>
          Your score breaks down into three weighted components - each traceable to a
          named dataset or research paper.
        </p>
        <p v-if="formulaError" class="formula-error">{{ formulaError }}</p>
        <div v-if="formulaComponents.length" class="weight-pills">
          <span v-for="item in formulaComponents" :key="item.key" :class="item.tone">
            {{ item.label }} - {{ item.weightPct }}%
          </span>
        </div>
      </section>

      <!-- Result sections render only after /api/cat-impact-score returns database rows. -->
      <section v-if="data" class="impact-result" :class="riskClass(scoreRiskKey)">
        <article class="score-card cw-card cw-card-pad">
          <div class="score-circle" :class="riskClass(scoreRiskKey)">
            <strong>{{ scoreDisplay }}</strong>
            <span>/100</span>
          </div>
          <div>
            <p class="result-label">Database Cat Impact Score</p>
            <h2>{{ location.suburbName }}</h2>
            <p>{{ location.postcode }} · {{ location.lgaName }} LGA</p>
          </div>
        </article>

        <!-- Components are fixed to the original red/blue/yellow meanings, not risk bands. -->
        <div class="cw-grid cw-grid-3 component-grid">
          <article
            v-for="component in components"
            :key="component.key"
            class="cw-card cw-card-pad component-card"
            :class="componentToneClass(component)"
          >
            <h3>{{ component.label }}</h3>
            <strong>{{ Number(component.score || 0).toFixed(1) }}</strong>
            <p>{{ component.rawDisplay }}</p>
            <small>{{ component.source }}</small>
          </article>
        </div>

        <!-- Ranking rows are already windowed by the API to include the searched suburb. -->
        <section v-if="rankingRows.length" class="ranking-card cw-card cw-card-pad">
          <h2>Nearby LGA Ranking</h2>
          <div
            v-for="row in rankingRows"
            :key="row.postcode"
            class="ranking-row"
            :class="[riskClass(riskKeyForScore(row.totalScore)), { current: row.isCurrent }]"
          >
            <span>#{{ row.position }}</span>
            <strong>{{ row.suburbName }}</strong>
            <em>{{ Math.round(row.totalScore) }}</em>
          </div>
        </section>
      </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.impact-prototype {
  min-height: calc(100dvh - 101px);
}

.impact-header {
  margin-bottom: 32px;
}

.calculator-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 162px;
  gap: 12px;
  padding: 24px;
  box-shadow: var(--cw-shadow);
}

.search-field {
  position: relative;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 2px solid var(--cw-border);
  border-radius: 12px;
  background: #f9fafb;
  padding: 0 18px;
}

.search-field > span {
  color: #9ca3af;
  font-size: 1.55rem;
}

.search-field input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--cw-text);
  font: inherit;
  font-size: 1rem;
}

.search-field input::placeholder {
  color: #7b7f87;
}

.calculator-card button {
  min-height: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--cw-emerald), var(--cw-teal));
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 850;
  font-size: 1rem;
}

.calculator-card button:disabled {
  cursor: wait;
  opacity: 0.7;
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
  border: 1px solid var(--cw-border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--cw-shadow);
}

.suggestions li {
  border-radius: 8px;
  cursor: pointer;
  padding: 10px 12px;
}

.suggestions li:hover {
  background: #ecfdf5;
}

.lookup-status {
  position: absolute;
  top: calc(100% + 10px);
  left: 12px;
  color: var(--cw-muted);
}

.error-line {
  margin: 18px 0 0;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f2;
  color: #b91c1c;
  padding: 12px 14px;
  font-weight: 750;
}

.component-intro {
  margin: 48px auto 0;
  text-align: center;
}

.component-intro p {
  max-width: 920px;
  margin: 0 auto;
  color: #6d736c;
  font-size: clamp(1.3rem, 2.4vw, 2rem);
  line-height: 1.35;
}

.weight-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 38px;
}

.weight-pills span {
  border: 2px solid;
  border-radius: 999px;
  padding: 8px 18px;
  font-size: clamp(1rem, 1.7vw, 1.25rem);
  font-weight: 900;
}

.formula-error {
  margin: 18px 0 0;
  font-size: 1rem;
  font-weight: 800;
}

.formula-error {
  color: #b91c1c;
}

.weight-red {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #a73743;
}

.weight-blue {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #25658a;
}

.weight-yellow {
  border-color: #fed78a;
  background: #fff7e6;
  color: #7a540f;
}

.impact-result {
  display: grid;
  gap: 24px;
  margin-top: 32px;
}

.score-card {
  display: flex;
  align-items: center;
  gap: 24px;
}

.score-circle {
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 999px;
  background: #ecfdf5;
  color: var(--cw-emerald);
}

.score-circle.risk-high {
  background: #fff1f2;
  color: #dc2626;
}

.score-circle.risk-medium {
  background: #fff7ed;
  color: #d97706;
}

.score-circle.risk-lower {
  background: #ecfdf5;
  color: #059669;
}

.score-circle strong {
  font-size: 2.9rem;
  line-height: 1;
}

.score-circle span {
  color: var(--cw-muted);
  font-weight: 800;
}

.result-label {
  margin: 0;
  color: var(--cw-emerald);
  font-weight: 850;
}

.impact-result.risk-high .result-label {
  color: #dc2626;
}

.impact-result.risk-medium .result-label {
  color: #d97706;
}

.impact-result.risk-lower .result-label {
  color: #059669;
}

.score-card h2 {
  margin: 8px 0 0;
  font-size: 2rem;
}

.score-card p:last-child {
  margin: 8px 0 0;
  color: var(--cw-muted);
}

.component-card h3,
.ranking-card h2 {
  margin: 0;
  color: var(--cw-text);
}

.component-card strong {
  display: block;
  margin-top: 14px;
  color: var(--cw-emerald);
  font-size: 2rem;
}

.component-card {
  border-top-width: 5px;
}

.component-card.component-red {
  border-top-color: #ef4444;
}

.component-card.component-blue {
  border-top-color: #3b82f6;
}

.component-card.component-yellow {
  border-top-color: #f59e0b;
}

.component-card.component-red strong {
  color: #dc2626;
}

.component-card.component-blue strong {
  color: #2563eb;
}

.component-card.component-yellow strong {
  color: #b77908;
}

.component-card p {
  color: var(--cw-muted);
}

.component-card small {
  color: var(--cw-soft-muted);
}

.ranking-row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 14px;
  border-top: 1px solid var(--cw-border);
  padding: 14px 0;
}

.ranking-row.current {
  color: var(--cw-emerald);
}

.ranking-row.risk-high.current {
  color: #dc2626;
}

.ranking-row.risk-medium.current {
  color: #d97706;
}

.ranking-row.risk-lower.current {
  color: #059669;
}

.ranking-row em {
  font-style: normal;
  font-weight: 900;
}

@media (max-width: 760px) {
  .calculator-card,
  .score-card {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
