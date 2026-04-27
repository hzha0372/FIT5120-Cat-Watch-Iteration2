<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Page state for postcode/suburb search, API loading, and score payloads.
const postcodeInput = ref('')
const loading = ref(false)
const lookupLoading = ref(false)
const error = ref('')
const data = ref(null)
const suggestions = ref([])
const showSuggestions = ref(false)
const selectedSuggestionPostcode = ref('')
const selectedSuggestionLabel = ref('')
const submittedInputLabel = ref('')
let lookupTimer = null
let lookupRequestId = 0
let suggestionSubmitGuard = false
let suggestionGuardTimer = null

// Extract the first Victorian-style 4-digit postcode from free text input.
const normalizePostcode = (value) => String(value || '').match(/\d{4}/)?.[0] || ''

const startsWithPostcode = (value) => /^\d{1,4}/.test(String(value || '').trim())

// Keep number formatting consistent between score cards, ranking rows, and side panels.
const formatNumber = (value, digits = 0) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return digits > 0 ? '0.0' : '0'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// Render database timestamps as compact local times for the UI.
const formatUpdatedAt = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Derived score state used by the ring, risk badges, and ranking summary.
const scoreTotal = computed(() => Number(data.value?.score?.total || 0))
const scoreDisplay = computed(() => String(Math.round(scoreTotal.value)))
const scorePercent = computed(() => Math.max(0, Math.min(100, scoreTotal.value)))
const risk = computed(() => data.value?.score?.risk || { key: 'lower', shortLabel: 'Lower risk' })
const location = computed(() => data.value?.location || null)
const components = computed(() => data.value?.components || [])
const ranking = computed(() => data.value?.ranking || null)
const currentRank = computed(() => ranking.value?.current || null)
const hasScore = computed(() => Boolean(data.value?.location))
const isRankingView = computed(() => route.query.view === 'ranking')
const updatedAt = computed(() => formatUpdatedAt(data.value?.score?.lastUpdated))

// Match score visuals to the current risk bucket.
const riskColor = computed(() => {
  if (risk.value.key === 'high') return '#b43743'
  if (risk.value.key === 'medium') return '#e69f24'
  return '#5f9239'
})

const scoreRingStyle = computed(() => ({
  background: `conic-gradient(${riskColor.value} 0deg ${scorePercent.value * 3.6}deg, #eef1ec ${scorePercent.value * 3.6}deg 360deg)`,
}))

// Build the ranking alert text from the API's pre-computed local ranking payload.
const comparisonTone = computed(() => (currentRank.value?.isTop30 ? 'high' : 'lower'))
const comparisonLabel = computed(() => {
  if (!location.value || !currentRank.value) return ''
  return `${location.value.suburbName} ranks in the top ${currentRank.value.topPercent}% most at-risk suburbs in ${location.value.lgaName} LGA for pet cat wildlife impact.`
})

// Map API component keys to CSS classes so each score part keeps its source color.
const componentClass = (key) => {
  if (key === 'containmentGap') return 'containment'
  if (key === 'wildlifeDensity') return 'wildlife'
  return 'roaming'
}

// Scale component meters against their weighted maximum contribution.
const componentBarStyle = (component) => {
  const score = Number(component.score || 0)
  const max = Math.max(1, Number(component.maxPoints || component.weightPct || 1))
  return { width: `${Math.max(3, Math.min(100, (score / max) * 100))}%` }
}

// Ranking bars use total score width and top-risk color thresholds.
const rowBarStyle = (row) => ({
  width: `${Math.max(4, Math.min(100, Number(row.totalScore || 0)))}%`,
  background: row.isTop30 ? '#b43743' : Number(row.totalScore || 0) >= 40 ? '#e69f24' : '#5f9239',
})

// Avoid rendering duplicate labels when a DB row has the postcode as the suburb name.
const cleanSuburbName = (postcode, name) => {
  const pc = String(postcode || '').trim()
  const suburb = String(name || '').trim()
  if (!suburb || suburb === pc) return ''
  return suburb
}

// Display labels combine postcode and suburb after the user selects a suggestion.
const suggestionName = (item) => cleanSuburbName(item?.postcode, item?.name)

const suggestionInputLabel = (item) => {
  const displayQuery = String(item?.displayQuery || '').trim()
  if (displayQuery) return displayQuery
  const postcode = String(item?.postcode || '').trim()
  const suburb = suggestionName(item)
  return [postcode, suburb].filter(Boolean).join(' ')
}

const scoreInputLabel = (payload) => {
  const postcode = payload?.location?.postcode
  const suburb = cleanSuburbName(postcode, payload?.location?.suburbName)
  return [postcode, suburb].filter(Boolean).join(' ')
}

// Load one postcode's fully pre-computed Cat Impact Score from the backend.
const loadScore = async (postcode) => {
  loading.value = true
  error.value = ''
  showSuggestions.value = false

  try {
    const response = await fetch(`/api/cat-impact-score?postcode=${encodeURIComponent(postcode)}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load Cat Impact Score.')
    data.value = payload
    postcodeInput.value = submittedInputLabel.value || scoreInputLabel(payload)
    submittedInputLabel.value = ''
  } catch (err) {
    data.value = null
    error.value = err?.message || 'Failed to load Cat Impact Score.'
  } finally {
    loading.value = false
  }
}

// Fetch search suggestions from the suburb database as the user types.
const lookupSuburbs = async () => {
  const q = postcodeInput.value.trim()
  const requestId = ++lookupRequestId
  if (q.length < 2) {
    suggestions.value = []
    return
  }

  lookupLoading.value = true
  try {
    const response = await fetch(`/api/suburbs?q=${encodeURIComponent(q)}&limit=6`)
    const payload = await response.json()
    if (requestId !== lookupRequestId || postcodeInput.value.trim() !== q) return
    suggestions.value = payload?.results || []
    showSuggestions.value = suggestions.value.length > 0
  } catch {
    if (requestId !== lookupRequestId) return
    suggestions.value = []
  } finally {
    if (requestId === lookupRequestId) {
      lookupLoading.value = false
    }
  }
}

// Debounce suburb lookup to avoid firing a query on every keystroke.
const onPostcodeInput = () => {
  selectedSuggestionPostcode.value = ''
  selectedSuggestionLabel.value = ''
  clearTimeout(lookupTimer)
  lookupTimer = setTimeout(lookupSuburbs, 160)
}

// Resolve either a direct postcode or a suburb name into one database postcode.
const resolvePostcodeFromInput = async () => {
  const text = postcodeInput.value.trim()
  if (selectedSuggestionPostcode.value && text === selectedSuggestionLabel.value) {
    return selectedSuggestionPostcode.value
  }

  const directPostcode = normalizePostcode(text)
  if (directPostcode) return directPostcode

  const response = await fetch(`/api/suburbs?q=${encodeURIComponent(text)}&limit=1`)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || 'Suburb lookup failed.')
  }

  const match = payload?.results?.[0]
  if (!match?.postcode) {
    throw new Error('Please enter a valid Victorian suburb or postcode.')
  }

  postcodeInput.value = suggestionInputLabel(match)
  return match.postcode
}

// Submit only when the user explicitly presses the main action button or Enter.
const submitPostcode = async () => {
  if (suggestionSubmitGuard) return

  const postcode = normalizePostcode(postcodeInput.value)
  if (!postcode && !postcodeInput.value.trim()) {
    error.value = 'Please enter a Victorian suburb or postcode.'
    return
  }

  try {
    error.value = ''
    const wasDirectPostcode = Boolean(normalizePostcode(postcodeInput.value))
    const hadSelectedSuggestion = Boolean(selectedSuggestionPostcode.value)
    const resolvedPostcode = await resolvePostcodeFromInput()
    submittedInputLabel.value = (!wasDirectPostcode || hadSelectedSuggestion) ? postcodeInput.value.trim() : ''
    router.push({ path: '/impact-score', query: { postcode: resolvedPostcode } })
  } catch (err) {
    error.value = err?.message || 'Please enter a valid Victorian suburb or postcode.'
  }
}

// Selecting a suggestion fills the input only; navigation happens through submitPostcode.
const selectSuggestion = (item) => {
  const label = suggestionInputLabel(item)
  postcodeInput.value = label
  selectedSuggestionLabel.value = label
  selectedSuggestionPostcode.value = String(item?.postcode || '').trim()
  error.value = ''
  showSuggestions.value = false
  suggestionSubmitGuard = true
  clearTimeout(suggestionGuardTimer)
  suggestionGuardTimer = setTimeout(() => {
    suggestionSubmitGuard = false
  }, 180)
}

// Capture suggestion clicks even when the nested text node receives the pointer event.
const selectSuggestionFromEvent = (event) => {
  const option = event.target?.closest?.('[data-suggestion-index]')
  const index = Number(option?.dataset?.suggestionIndex)
  const item = Number.isInteger(index) ? suggestions.value[index] : null
  if (item) selectSuggestion(item)
}

// Switch into the local ranking view while keeping the selected postcode in the query string.
const openRanking = () => {
  if (!location.value?.postcode) return
  router.push({ path: '/impact-score', query: { postcode: location.value.postcode, view: 'ranking' } })
}

// Navigate from a ranking row to that suburb's full score page.
const goToPostcode = (postcode) => {
  router.push({ path: '/impact-score', query: { postcode } })
}

// Keep URL query state and score data synchronized across direct links and row clicks.
watch(
  () => route.query.postcode,
  (value) => {
    const postcode = normalizePostcode(value)
    postcodeInput.value = postcode || ''
    if (postcode) {
      loadScore(postcode)
    } else {
      data.value = null
      error.value = ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="impact-page">
    <main v-if="!isRankingView" class="impact-shell">
      <header class="page-header" :class="{ 'empty-mode': !hasScore }">
        <div>
          <h1>Suburb Cat Impact Score</h1>
          <p>
            A 0-100 score showing the pet cat wildlife impact in your Victorian suburb,
            built from three research-backed sub-scores. PET cats only - not feral cats.
          </p>
        </div>

        <div class="postcode-form">
          <form @submit.prevent="submitPostcode">
            <label class="sr-only" for="impact-postcode">Victorian suburb or postcode</label>
            <div class="input-row">
              <input
                id="impact-postcode"
                v-model="postcodeInput"
                autocomplete="off"
                inputmode="search"
                placeholder="Suburb or Postcode"
                @focus="lookupSuburbs"
                @input="onPostcodeInput"
                @keydown.enter.prevent="showSuggestions = false"
              />
              <button type="button" @mousedown.prevent @click="submitPostcode">
                Show impact score
              </button>
            </div>
          </form>

          <div
            v-if="showSuggestions"
            class="suggestions"
            @pointerdown.capture.prevent.stop="selectSuggestionFromEvent"
            @mousedown.capture.prevent.stop="selectSuggestionFromEvent"
          >
            <button
              v-for="(item, index) in suggestions"
              :key="item.id"
              :data-suggestion-index="index"
              type="button"
              @pointerdown.prevent.stop="selectSuggestion(item)"
              @pointerup.prevent.stop="selectSuggestion(item)"
              @mousedown.prevent.stop="selectSuggestion(item)"
              @mouseup.prevent.stop="selectSuggestion(item)"
              @click.prevent.stop="selectSuggestion(item)"
            >
              <strong v-if="startsWithPostcode(postcodeInput)">{{ item.postcode }}</strong>
              <span v-if="suggestionName(item)">{{ suggestionName(item) }}</span>
            </button>
          </div>
        </div>
      </header>

      <p v-if="error" class="error">{{ error }}</p>

      <section v-if="!hasScore && !loading" class="empty-state">
        <h2>Enter your suburb or postcode to get started</h2>
        <p>
          Your score breaks down into three weighted components - each traceable
          to a named dataset or research paper.
        </p>
        <div class="empty-tags">
          <span class="containment">Containment gap - 45%</span>
          <span class="wildlife">Wildlife density - 35%</span>
          <span class="roaming">Roaming cat density - 20%</span>
        </div>
      </section>

      <template v-if="hasScore">
        <!-- Score cards are populated from /api/cat-impact-score rather than local fixtures. -->
        <section class="score-layout">
          <article class="score-card">
            <div class="hero-row">
              <div class="score-ring" :style="scoreRingStyle">
                <div>
                  <strong>{{ scoreDisplay }}</strong>
                  <span>out of 100</span>
                </div>
              </div>

              <div class="score-title">
                <h2>{{ location.suburbName }}</h2>
                <p>Postcode {{ location.postcode }} · {{ location.lgaName }} LGA · Updated daily at {{ updatedAt || '2:00 am' }}</p>
                <div class="risk-badge" :class="risk.key">
                  <i />
                  <strong>{{ risk.label }}</strong>
                </div>
                <p class="pet-only">✓ PET cats only - feral cats are not counted in this score</p>
              </div>
            </div>

            <div class="subscore-table">
              <div class="table-head">
                <span>Sub-score</span>
                <span>Raw value & source</span>
                <span>Points</span>
              </div>

              <div
                v-for="component in components"
                :key="component.key"
                class="component-row"
                :class="componentClass(component.key)"
              >
                <div class="component-name">
                  <strong>{{ component.label }}</strong>
                  <span>{{ component.weightPct }}% weight</span>
                </div>
                <div class="raw-source">
                  <div class="meter">
                    <i :style="componentBarStyle(component)" />
                  </div>
                  <p>{{ component.rawDisplay }}</p>
                  <small>{{ component.source }}</small>
                </div>
                <strong class="points">{{ formatNumber(component.score, 1) }}</strong>
              </div>
            </div>
          </article>

          <aside class="side-stack">
            <section class="side-card">
              <p class="panel-label">Score Breakdown</p>
              <strong class="big-score" :class="risk.key">{{ scoreDisplay }}</strong>
              <span class="risk-text">{{ risk.shortLabel }}</span>
              <small>{{ risk.description }}</small>
              <dl>
                <div v-for="component in components" :key="component.key">
                  <dt>{{ component.label }}</dt>
                  <dd :class="componentClass(component.key)">
                    {{ formatNumber(component.score, 1) }}
                  </dd>
                </div>
              </dl>
            </section>

            <section class="side-card">
              <p class="panel-label">Risk Levels</p>
              <div class="risk-level high" :class="{ active: risk.key === 'high' }">
                <strong>High impact<span v-if="risk.key === 'high'"> (you)</span></strong>
                <span>&gt;70</span>
              </div>
              <div class="risk-level medium" :class="{ active: risk.key === 'medium' }">
                <strong>Medium<span v-if="risk.key === 'medium'"> (you)</span></strong>
                <span>40-70</span>
              </div>
              <div class="risk-level lower" :class="{ active: risk.key === 'lower' }">
                <strong>Lower risk<span v-if="risk.key === 'lower'"> (you)</span></strong>
                <span>&lt;40</span>
              </div>
            </section>
          </aside>
        </section>

        <button class="compare-button" type="button" @click="openRanking">
          → Compare {{ location.suburbName }} to nearby {{ location.lgaName }} LGA suburbs
        </button>
      </template>
    </main>

    <main v-else-if="hasScore" class="ranking-shell">
      <RouterLink class="back-link button-like" :to="{ path: '/impact-score', query: { postcode: location.postcode } }">
        ← Back to {{ location.suburbName }} score
      </RouterLink>

      <section class="ranking-layout">
        <!-- Ranking rows use the same database-backed LGA payload returned with the score. -->
        <div class="ranking-main">
          <header class="ranking-header">
            <h1>{{ ranking.lgaName }} LGA - Suburb Ranking</h1>
            <p>
              {{ ranking.totalSuburbs }} suburbs ranked by total cat impact score,
              highest to lowest. Click any suburb to view its full score.
            </p>
          </header>

          <article class="percentile-card" :class="comparisonTone">
            <strong>{{ comparisonLabel }}</strong>
            <span>
              Your suburb is ranked #{{ currentRank.position }} of {{ ranking.totalSuburbs }}.
              Tap any suburb to view its full score breakdown. Scores are read from pre-computed database rows.
            </span>
          </article>

          <div class="ranking-table">
            <div class="ranking-head">
              <span>#</span>
              <span>Suburb</span>
              <span>Score bar</span>
              <span>Containment</span>
              <span>Total</span>
            </div>

            <button
              v-for="row in ranking.rows"
              :key="row.postcode"
              class="ranking-row"
              :class="{ current: row.isCurrent, high: row.isTop30 }"
              type="button"
              @click="goToPostcode(row.postcode)"
            >
              <span class="rank">#{{ row.position }}</span>
              <span class="suburb-cell">
                <strong>{{ row.suburbName }}</strong>
                <small>{{ row.postcode }}</small>
              </span>
              <span class="score-bar" aria-hidden="true">
                <i :style="rowBarStyle(row)" />
              </span>
              <span class="containment-cell">{{ formatNumber(row.containmentGapRaw, 1) }}% no containment</span>
              <span class="total-cell">{{ Math.round(row.totalScore) }}<small>/100</small></span>
            </button>
          </div>
        </div>

        <aside class="ranking-aside">
          <section class="side-card your-suburb" :class="risk.key">
            <p class="panel-label">Your Suburb</p>
            <h2>{{ location.suburbName }}</h2>
            <p>Ranked #{{ currentRank.position }} of {{ ranking.totalSuburbs }}</p>
            <dl>
              <div>
                <dt>Your score</dt>
                <dd>{{ scoreDisplay }} / 100</dd>
              </div>
              <div>
                <dt>LGA percentile</dt>
                <dd>Top {{ currentRank.topPercent }}%</dd>
              </div>
              <div>
                <dt>LGA</dt>
                <dd>{{ ranking.lgaName }}</dd>
              </div>
            </dl>
          </section>

          <section class="side-card">
            <p class="panel-label">Score Guide</p>
            <div class="risk-level high" :class="{ active: risk.key === 'high' }">
              <strong>High impact<span v-if="risk.key === 'high'"> (you)</span></strong>
              <span>&gt;70</span>
            </div>
            <div class="risk-level medium" :class="{ active: risk.key === 'medium' }">
              <strong>Medium<span v-if="risk.key === 'medium'"> (you)</span></strong>
              <span>40-70</span>
            </div>
            <div class="risk-level lower" :class="{ active: risk.key === 'lower' }">
              <strong>Lower risk<span v-if="risk.key === 'lower'"> (you)</span></strong>
              <span>&lt;40</span>
            </div>
          </section>
        </aside>
      </section>
    </main>
  </section>
</template>

<style scoped>
.impact-page {
  min-height: calc(100dvh - 80px);
  background: #e7e9e3;
  color: #20231f;
  padding: 44px 28px;
}

.impact-shell,
.ranking-shell {
  width: 100%;
  max-width: 1860px;
  margin: 0 auto;
}

.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(460px, 560px);
  gap: 38px;
  align-items: start;
  margin-bottom: 34px;
}

.page-header.empty-mode {
  grid-template-columns: 1fr;
  justify-items: center;
  text-align: center;
  margin-bottom: 54px;
}

.page-header.empty-mode > div {
  max-width: 1260px;
}

.page-header.empty-mode .postcode-form {
  width: min(780px, 100%);
  margin-top: 12px;
}

.page-header h1,
.ranking-header h1 {
  margin: 0;
  color: #20231f;
  font-size: 3rem;
  line-height: 1.08;
  font-weight: 850;
}

.page-header p,
.ranking-header p {
  margin: 10px 0 0;
  color: #62675f;
  font-size: 1.45rem;
  line-height: 1.42;
}

.postcode-form {
  position: relative;
}

.input-row {
  display: flex;
  gap: 0;
}

.input-row input {
  min-width: 0;
  width: 100%;
  height: 64px;
  border: 1px solid #c8d2c5;
  border-right: 0;
  border-radius: 6px 0 0 6px;
  background: #fff;
  color: #20231f;
  font: inherit;
  font-size: 1.28rem;
  padding: 0 22px;
  outline: 0;
}

.input-row input:focus {
  border-color: #143f2b;
  box-shadow: 0 0 0 3px rgba(20, 63, 43, 0.16);
}

.input-row button,
.compare-button {
  border: 0;
  border-radius: 0 6px 6px 0;
  background: #143f2b;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 850;
  font-size: 1.34rem;
  padding: 0 28px;
  white-space: nowrap;
}

.suggestions {
  position: absolute;
  z-index: 20;
  top: 72px;
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid #c7d2c4;
  border-radius: 6px;
  background: #fbfcfa;
  box-shadow: 0 16px 30px rgba(20, 63, 43, 0.14);
}

.suggestions button {
  width: 100%;
  border: 0;
  border-bottom: 1px solid #e4ebe1;
  background: #fbfcfa;
  color: #20231f;
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: 13px 16px;
  text-align: left;
  font-size: 1.06rem;
}

.suggestions button:hover,
.suggestions button:focus {
  background: #eef7e8;
}

.lookup-status,
.status,
.error {
  margin: 10px 0 0;
  border-radius: 6px;
  padding: 10px 12px;
  font-weight: 750;
}

.lookup-status,
.status {
  border: 1px solid #cbdcbd;
  background: #eef8e5;
  color: #314a2f;
}

.error {
  border: 1px solid #efc8ce;
  background: #fff0f2;
  color: #95303b;
}

.empty-state {
  min-height: 280px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 18px;
  text-align: center;
}

.empty-state h2 {
  margin: 0;
  font-size: 1.8rem;
}

.empty-state p {
  margin: 0;
  max-width: 780px;
  color: #686d66;
  font-size: 1.3rem;
}

.empty-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.empty-tags span,
.component-name span {
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 1.03rem;
  font-weight: 800;
}

.score-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 38px;
  align-items: start;
}

.score-card,
.side-card,
.percentile-card {
  border: 1px solid #d7ded4;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(20, 43, 28, 0.06);
}

.score-card {
  overflow: hidden;
}

.hero-row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 30px;
  align-items: center;
  padding: 38px 38px 18px;
}

.score-ring {
  width: 154px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.score-ring > div {
  width: 112px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 0 0 1px #edf0ea;
  display: grid;
  place-items: center;
  align-content: center;
}

.score-ring strong {
  color: v-bind(riskColor);
  font-size: 3.1rem;
  line-height: 1;
  font-weight: 900;
}

.score-ring span {
  color: #8a8f87;
  font-size: 0.9rem;
  font-weight: 800;
}

.score-title h2 {
  margin: 0;
  font-size: 2.1rem;
  line-height: 1.12;
}

.score-title > p {
  margin: 8px 0 0;
  color: #70756d;
  font-size: 1.12rem;
}

.risk-badge {
  width: fit-content;
  margin-top: 10px;
  border: 1px solid #efc8ce;
  border-radius: 6px;
  background: #fff0f2;
  color: #9a313d;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 11px;
  font-size: 1.08rem;
}

.risk-badge.medium {
  border-color: #efd5a0;
  background: #fff1d8;
  color: #8a611c;
}

.risk-badge.lower {
  border-color: #c9dfbd;
  background: #eef7e6;
  color: #4f7837;
}

.risk-badge i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: currentColor;
}

.pet-only {
  width: min(800px, 100%);
  border: 1px solid #c9dfbd;
  border-radius: 6px;
  background: #eef7e6;
  color: #2f5129;
  padding: 12px 16px;
  font-size: 1.12rem;
  font-weight: 800;
}

.subscore-table {
  padding: 0 28px 24px;
}

.table-head,
.component-row {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr) 120px;
  gap: 28px;
  align-items: center;
}

.table-head {
  border-top: 1px solid #e8ebe6;
  border-bottom: 1px solid #e8ebe6;
  color: #9a9f98;
  font-size: 1rem;
  padding: 12px 14px;
}

.table-head span:last-child {
  text-align: right;
}

.component-row {
  min-height: 118px;
  border-bottom: 1px solid #ecefea;
  padding: 18px 14px;
}

.component-name strong {
  display: block;
  margin-bottom: 9px;
  font-size: 1.38rem;
}

.containment .component-name span,
.empty-tags .containment {
  border-color: #efc8ce;
  background: #fff0f2;
  color: #95303b;
}

.wildlife .component-name span,
.empty-tags .wildlife {
  border-color: #c9dded;
  background: #edf7fc;
  color: #2a678e;
}

.roaming .component-name span,
.empty-tags .roaming {
  border-color: #efd5a0;
  background: #fff1d8;
  color: #7b5617;
}

.meter {
  width: 60%;
  min-width: 230px;
  height: 7px;
  border-radius: 999px;
  background: #eef1ec;
  overflow: hidden;
}

.meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.containment .meter i {
  background: #c34b56;
}

.wildlife .meter i {
  background: #3b82b7;
}

.roaming .meter i {
  background: #e6a125;
}

.raw-source p {
  margin: 10px 0 0;
  font-size: 1.18rem;
}

.raw-source small {
  display: block;
  margin-top: 2px;
  color: #a1a59f;
  font-size: 1rem;
}

.points {
  color: v-bind(riskColor);
  font-size: 2rem;
  text-align: right;
}

.component-row.containment .points {
  color: #b43743;
}

.component-row.wildlife .points {
  color: #2f79b3;
}

.component-row.roaming .points {
  color: #e69f24;
}

.side-stack,
.ranking-aside {
  display: grid;
  gap: 16px;
}

.side-card {
  padding: 24px;
}

.panel-label {
  margin: 0;
  color: #828a82;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
}

.big-score {
  display: block;
  margin-top: 14px;
  font-size: 3.7rem;
  line-height: 1;
}

.big-score.high,
.side-card dd.high,
.points.high {
  color: #b43743;
}

.big-score.medium,
.side-card dd.medium {
  color: #e69f24;
}

.big-score.lower,
.side-card dd.lower {
  color: #5f9239;
}

.risk-text {
  display: block;
  margin-top: 4px;
  color: #465047;
  font-size: 1.18rem;
  font-weight: 850;
}

.side-card small {
  color: #7f877f;
  font-size: 1rem;
}

.side-card dl {
  margin: 12px 0 0;
  border-top: 1px solid #e9ece7;
}

.side-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #eef0ed;
  padding: 7px 0;
}

.side-card dt {
  color: #626b63;
  font-size: 1rem;
}

.side-card dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
}

.side-card dd.containment {
  color: #b43743;
}

.side-card dd.wildlife {
  color: #2f79b3;
}

.side-card dd.roaming {
  color: #e69f24;
}

.risk-level {
  border-radius: 6px;
  margin-top: 10px;
  padding: 14px 16px;
}

.risk-level > strong,
.risk-level > span {
  display: block;
  font-size: 1.08rem;
}

.risk-level strong span {
  display: inline;
  font-size: inherit;
}

.risk-level.high {
  border: 1px solid transparent;
  background: #f7f8f6;
  color: #9f3440;
}

.risk-level.medium {
  border: 1px solid transparent;
  background: #f7f8f6;
  color: #856018;
}

.risk-level.lower {
  border: 1px solid transparent;
  background: #f7f8f6;
  color: #467431;
}

.risk-level.high.active {
  border-color: #edc0c7;
  background: #fff1f3;
}

.risk-level.medium.active {
  border-color: #edcd8f;
  background: #fff2d9;
}

.risk-level.lower.active {
  border-color: #bdd9b0;
  background: #edf8e7;
}

.ranking-aside .side-card {
  border-color: #d7ded4;
  background: #fff;
}

.ranking-aside .panel-label {
  color: #9c9f99;
}

.ranking-aside .your-suburb h2 {
  font-size: 1.45rem;
  line-height: 1.15;
}

.ranking-aside .your-suburb p {
  font-size: 1rem;
}

.ranking-aside .your-suburb dt,
.ranking-aside .your-suburb dd {
  font-size: 1.08rem;
}

.ranking-aside .your-suburb.high h2,
.ranking-aside .your-suburb.high dl div:nth-child(1) dd,
.ranking-aside .your-suburb.high dl div:nth-child(2) dd {
  color: #9a313d;
}

.ranking-aside .your-suburb.medium h2,
.ranking-aside .your-suburb.medium dl div:nth-child(1) dd,
.ranking-aside .your-suburb.medium dl div:nth-child(2) dd {
  color: #8a621c;
}

.ranking-aside .your-suburb.lower h2,
.ranking-aside .your-suburb.lower dl div:nth-child(1) dd,
.ranking-aside .your-suburb.lower dl div:nth-child(2) dd {
  color: #4f7837;
}

.ranking-aside .your-suburb dl div:nth-child(3) dd {
  color: #1f231f;
}

.ranking-aside .risk-level.high {
  border-color: transparent;
  background: #f7f8f6;
  color: #9a313d;
}

.ranking-aside .risk-level.medium {
  border-color: transparent;
  background: #f7f8f6;
  color: #8a621c;
}

.ranking-aside .risk-level.lower {
  border-color: transparent;
  background: #f7f8f6;
  color: #4f7837;
}

.ranking-aside .risk-level.high.active {
  border-color: #edc0c7;
  background: #fff1f3;
}

.ranking-aside .risk-level.medium.active {
  border-color: #edcd8f;
  background: #fff2d9;
}

.ranking-aside .risk-level.lower.active {
  border-color: #bdd9b0;
  background: #edf8e7;
}

.compare-button {
  width: calc(100% - 368px);
  min-height: 58px;
  margin-top: 22px;
  border-radius: 6px;
  font-size: 1.18rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  margin-bottom: 18px;
  color: #7c827a;
  font-size: 1rem;
  text-decoration: none;
}

.back-link.button-like {
  min-height: 46px;
  border-radius: 6px;
  background: #143f2b;
  color: #fff;
  padding: 0 18px;
  font-size: 1.08rem;
  font-weight: 850;
  box-shadow: 0 8px 18px rgba(20, 63, 43, 0.18);
}

.back-link:hover {
  color: #fff;
  background: #1d4f37;
}

.ranking-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 38px;
  align-items: start;
}

.ranking-header {
  margin-bottom: 10px;
}

.percentile-card {
  border-left: 5px solid #5f9239;
  margin: 0 0 16px;
  padding: 13px 15px;
}

.percentile-card.high {
  border-left-color: #b43743;
}

.percentile-card strong {
  color: #496e36;
  display: block;
  font-size: 0.92rem;
}

.percentile-card.high strong {
  color: #9a313d;
}

.percentile-card span {
  color: #5e655d;
  display: block;
  font-size: 0.84rem;
  margin-top: 5px;
}

.ranking-table {
  overflow: hidden;
  border-radius: 8px;
}

.ranking-head,
.ranking-row {
  display: grid;
  grid-template-columns: 44px minmax(180px, 1fr) 240px 130px 72px;
  gap: 12px;
  align-items: center;
}

.ranking-head {
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  color: #979c95;
  font-size: 0.78rem;
  padding: 9px 12px;
}

.ranking-row {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
  background: transparent;
  color: #20231f;
  cursor: pointer;
  font: inherit;
  padding: 9px 12px;
  text-align: left;
}

.ranking-row:hover {
  background: rgba(255, 255, 255, 0.5);
}

.ranking-row.current {
  background: #eef7e6;
  box-shadow: inset 5px 0 0 #5f9239;
}

.ranking-row.current.high {
  background: #fff0f2;
  box-shadow: inset 5px 0 0 #b43743;
}

.rank {
  color: #878d85;
  font-weight: 800;
}

.suburb-cell strong,
.suburb-cell small {
  display: block;
}

.suburb-cell strong {
  font-weight: 900;
}

.suburb-cell small {
  color: #8d928b;
  font-size: 0.72rem;
}

.score-bar {
  height: 7px;
  border-radius: 999px;
  background: #eef1ec;
  overflow: hidden;
}

.score-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.containment-cell {
  color: #60665f;
  font-size: 0.78rem;
}

.total-cell {
  text-align: right;
  font-size: 1.26rem;
  font-weight: 900;
}

.total-cell small {
  color: #9a9f98;
  font-size: 0.62rem;
  font-weight: 500;
}

.your-suburb h2 {
  margin: 9px 0 0;
  color: #b43743;
  font-size: 1.15rem;
}

.your-suburb p {
  margin: 4px 0 0;
  color: #5f655e;
  font-size: 0.78rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 980px) {
  .page-header,
  .score-layout,
  .ranking-layout {
    grid-template-columns: 1fr;
  }

  .compare-button {
    width: 100%;
  }

  .ranking-head,
  .ranking-row {
    grid-template-columns: 42px minmax(150px, 1fr) 80px;
  }

  .ranking-head span:nth-child(3),
  .ranking-head span:nth-child(4),
  .score-bar,
  .containment-cell {
    display: none;
  }
}

@media (max-width: 720px) {
  .impact-page {
    padding: 24px 12px;
  }

  .page-header h1,
  .ranking-header h1 {
    font-size: 2.2rem;
    overflow-wrap: anywhere;
  }

  .page-header p,
  .ranking-header p {
    font-size: 1.08rem;
  }

  .input-row {
    display: grid;
  }

  .input-row input,
  .input-row button {
    border: 1px solid #c8d2c5;
    border-radius: 6px;
  }

  .input-row button {
    height: 42px;
    margin-top: 8px;
  }

  .hero-row,
  .table-head,
  .component-row {
    grid-template-columns: 1fr;
  }

  .hero-row {
    padding: 20px;
  }

  .score-title h2 {
    font-size: 1.8rem;
  }

  .table-head {
    display: none;
  }

  .meter {
    min-width: 0;
    width: 100%;
  }

  .points {
    text-align: left;
  }
}
</style>
