<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

const loading = ref(false)
const error = ref('')
const data = ref(null)

// Fetch home summary data and update page state.
const fetchSummary = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/cat-scoreboard')
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load home data')
    }
    data.value = payload
  } catch (err) {
    error.value = err?.message || 'Failed to load home data'
  } finally {
    loading.value = false
  }
}

onMounted(fetchSummary)

const catName = computed(() => 'Cat')
const suburbName = computed(() => data.value?.user?.suburbName || 'Unknown suburb')
const suburbCode = computed(() => data.value?.user?.postcode || '')
const ageYears = computed(() => Number(data.value?.user?.catAgeYears || 0))
const sexLabel = computed(() => {
  const sex = String(data.value?.user?.catSex || '').toUpperCase()
  if (sex === 'M') return 'male'
  if (sex === 'F') return 'female'
  return 'male'
})

const preventedDisplay = computed(() =>
  Number.isFinite(Number(data.value?.scoreboard?.preventedEstimated))
    ? Number(data.value.scoreboard.preventedEstimated).toFixed(2)
    : '0.00',
)

// Format time into a readable display string.
const formatTime = (value) => {
  const txt = String(value || '')
  const m = txt.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  const h24 = Number(m[1])
  const minute = m[2]
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  if (minute === '00') return `${h12} ${suffix}`
  return `${h12}:${minute} ${suffix}`
}

const morningRiskWindow = computed(() => {
  const out = formatTime(data.value?.schedule?.morningOut)
  const inn = formatTime(data.value?.schedule?.morningIn)
  if (!out || !inn) return 'N/A'
  return `${out} - ${inn}`
})
const eveningRiskWindow = computed(() => {
  const out = formatTime(data.value?.schedule?.eveningOut)
  const inn = formatTime(data.value?.schedule?.eveningIn)
  if (!out || !inn) return 'N/A'
  return `${out} - ${inn}`
})

const outdoorCatPct = computed(() => Number(data.value?.behaviourStats?.outdoorCatPct?.value || 0))
const clandestinePct = computed(() => Number(data.value?.behaviourStats?.clandestinePct?.value || 0))
const preyMedianMonthly = computed(() => Number(data.value?.behaviourStats?.preyMedianMonthly?.value || 0))
const threatenedSpeciesCount = computed(() =>
  Number(
    data.value?.localArea?.raw?.threatenedSpeciesCountDedupPoint ??
      data.value?.localArea?.raw?.threatenedSpeciesCount ??
      0,
  ),
)
</script>

<template>
  <section class="home-page">
    <div class="home-shell">
      <section class="hero-grid">
        <article class="hero-main">
          <p class="eyebrow">{{ suburbName.toUpperCase() }} VIC {{ suburbCode }} · LIVE DATABASE</p>
          <h1>
            {{ catName }} came home.
            <br />
            <span>Now every log counts.</span>
          </h1>
          <p>
            While {{ catName }} was outside this morning, {{ threatenedSpeciesCount }} threatened species were active
            within 5km of your home. See exactly which ones - and what you can do about it.
          </p>
          <RouterLink to="/risk-map" class="btn-primary">Show me what's out there →</RouterLink>
        </article>

        <article class="hero-profile">
          <p class="panel-label">{{ catName }}'s profile</p>
          <div class="profile-row">
            <div class="cat-icon">🐱</div>
            <div>
              <h2>{{ catName }} · {{ ageYears || '-' }}-year-old {{ sexLabel }}</h2>
              <p class="sub">{{ suburbName }} VIC {{ suburbCode }} · Cat owner</p>
            </div>
          </div>
          <div class="risk-tags">
            <span class="tag high">HIGH RISK · {{ morningRiskWindow }}</span>
            <span class="tag high soft">RISK · {{ eveningRiskWindow }}</span>
            <span class="tag safe">Safe · Overnight</span>
          </div>

          <div class="stats-row">
            <div class="mini-card">
              <strong>{{ threatenedSpeciesCount }}</strong>
              <small>Threatened species</small>
            </div>
            <div class="mini-card good">
              <strong>~{{ preventedDisplay }}</strong>
              <small>Estimated wildlife encounters per month</small>
            </div>
          </div>

          <div class="warning-box">
            <strong>Behaviour baseline from database</strong>
            <p>
              Outdoor cats: {{ outdoorCatPct.toFixed(1) }}% · Hidden hunting: {{ clandestinePct.toFixed(1) }}% ·
              Median prey/month: {{ preyMedianMonthly.toFixed(1) }}
            </p>
          </div>
        </article>
      </section>

      <section class="section-block">
        <p class="section-label">How CatWatch works</p>
        <h3>Three steps to understanding {{ catName }}'s impact</h3>
        <div class="card-grid three">
          <article class="info-card">
            <span class="step">1</span>
            <h4>See what's near you</h4>
            <p>Open threatened species records near your suburb, grouped by conservation status.</p>
            <RouterLink to="/risk-map">Open Risk Map →</RouterLink>
          </article>
          <article class="info-card">
            <span class="step">2</span>
            <h4>Check your scoreboard</h4>
            <p>Review caused vs prevented estimates and weekly containment change over time.</p>
            <RouterLink to="/cat-scoreboard">View Scoreboard →</RouterLink>
          </article>
          <article class="info-card">
            <span class="step">3</span>
            <h4>Understand the bigger picture</h4>
            <p>Learn why these local choices matter for wildlife, and how CatWatch helps turn insight into action.</p>
            <RouterLink to="/vision-mission">Read Our Mission →</RouterLink>
          </article>
        </div>
      </section>

      <section class="section-block alt">
        <p class="section-label">Explore</p>
        <h3>Where do you want to start?</h3>
        <div class="card-grid three">
          <article class="link-card">
            <h4>Wildlife Risk Map</h4>
            <p>Check threatened species recorded near your suburb and identify high-risk roaming windows.</p>
            <RouterLink to="/risk-map">Open map →</RouterLink>
          </article>
          <article class="link-card">
            <h4>Suburb Impact Score</h4>
            <p>See the local pet cat impact score, source-backed components, and LGA ranking.</p>
            <RouterLink to="/impact-score">View score →</RouterLink>
          </article>
          <article class="link-card">
            <h4>Cat's Scoreboard</h4>
            <p>Review your latest prevented-vs-caused encounter summary and weekly containment trend.</p>
            <RouterLink to="/cat-scoreboard">View scoreboard →</RouterLink>
          </article>
          <article class="link-card">
            <h4>Our Mission</h4>
            <p>Understand purpose and live evidence from your database, without static placeholder numbers.</p>
            <RouterLink to="/vision-mission">Read more →</RouterLink>
          </article>
        </div>
      </section>

      <p v-if="loading" class="status">Loading live summary...</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.home-page {
  min-height: calc(100dvh - 90px);
  background: #f3f4f2;
  padding: 14px;
}

.home-shell {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  border: 1px solid #d7ddd7;
  background: #fafbfa;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 0;
  border-bottom: 1px solid #d7ddd7;
}

.hero-main {
  background: linear-gradient(145deg, #166338 0%, #135a33 40%, #0f4f2d 100%);
  color: #eef5f0;
  padding: 30px;
}

.eyebrow {
  display: inline-flex;
  background: rgba(215, 243, 220, 0.2);
  border: 1px solid rgba(228, 245, 230, 0.28);
  color: #cde9d3;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hero-main h1 {
  margin-top: 18px;
  font-size: 3rem;
  line-height: 1.1;
  font-weight: 800;
}

.hero-main h1 span {
  color: #7ef0a7;
}

.hero-main p {
  margin-top: 14px;
  max-width: 540px;
  color: #d7e8db;
  font-size: 1.03rem;
}

.btn-primary {
  margin-top: 18px;
  display: inline-block;
  text-decoration: none;
  color: #123d28;
  background: #59e087;
  border: 1px solid #63e78f;
  border-radius: 10px;
  padding: 11px 16px;
  font-weight: 800;
}

.hero-profile {
  background: #f9fbf9;
  padding: 24px;
}

.panel-label {
  text-transform: uppercase;
  font-weight: 700;
  font-size: 1.03rem;
  letter-spacing: 0.08em;
  color: #7b837f;
}

.hero-profile h2 {
  margin: 0;
  font-size: 1.7rem;
  color: #21332a;
  font-weight: 800;
}

.sub {
  margin-top: 2px;
  color: #6d7771;
  font-size: 0.92rem;
}

.profile-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.cat-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid #cfe0d2;
  background: #eaf7ee;
  display: grid;
  place-items: center;
  font-size: 2rem;
}

.risk-tags {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.74rem;
  font-weight: 800;
}

.tag.high {
  background: #fcecec;
  border: 1px solid #f0b1b1;
  color: #a63a3a;
}

.tag.high.soft {
  background: #fff6df;
  border-color: #f0ddb2;
  color: #8a6315;
}

.tag.safe {
  background: #e8f5ea;
  border: 1px solid #b9dcbf;
  color: #2b7440;
}

.stats-row {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mini-card {
  border: 1px solid #dee3de;
  background: #fff;
  border-radius: 10px;
  padding: 12px;
}

.mini-card.good {
  background: #f0f9f0;
  border-color: #c9e3cb;
}

.mini-card strong {
  font-size: 1.8rem;
  color: #1c3b2d;
  line-height: 1;
}

.mini-card small {
  display: block;
  margin-top: 6px;
  color: #64726a;
  font-size: 1.03rem;
}

.warning-box {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid #f0ddb2;
  background: #fff6df;
  padding: 10px;
}

.warning-box strong {
  color: #8a6315;
  font-size: 0.92rem;
}

.warning-box p {
  margin: 4px 0 0;
  color: #74664a;
  font-size: 0.88rem;
}

.section-block {
  padding: 26px 20px;
  border-bottom: 1px solid #e1e4e1;
}

.section-block.alt {
  background: #f6f8f6;
}

.section-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1.03rem;
  color: #6f7772;
  font-weight: 700;
}

.section-block h3 {
  margin-top: 6px;
  font-size: 2rem;
  color: #1f2e27;
}

.card-grid {
  margin-top: 14px;
  display: grid;
  gap: 14px;
}

.card-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.info-card,
.link-card {
  border: 1px solid #dde3dd;
  background: #ffffff;
  border-radius: 12px;
  padding: 14px;
}

.step {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #175b35;
  color: #fff;
  font-size: 0.82rem;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.info-card h4,
.link-card h4 {
  margin-top: 10px;
  font-size: 1.2rem;
  color: #1f2d27;
}

.info-card p,
.link-card p {
  margin-top: 8px;
  color: #5f6d65;
  min-height: 72px;
}

.info-card a,
.link-card a {
  color: #1c5e38;
  text-decoration: none;
  font-weight: 800;
}

.status,
.error {
  margin: 12px 20px 20px;
  font-size: 0.92rem;
}

.status {
  color: #45614f;
}

.error {
  color: #a12f2f;
}

@media (max-width: 980px) {
  .hero-grid,
  .card-grid.three {
    grid-template-columns: 1fr;
  }

  .hero-main h1 {
    font-size: 2.35rem;
  }

  .section-block h3 {
    font-size: 1.65rem;
  }

  .info-card p,
  .link-card p {
    min-height: 0;
  }
}
</style>
