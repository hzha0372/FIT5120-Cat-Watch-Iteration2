<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

const loading = ref(false)
const error = ref('')
const data = ref(null)
let timer = null

// Fetch Cat's Scoreboard data and update page state.
const fetchScoreboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/cat-scoreboard')
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load Cat Scoreboard')
    }
    data.value = payload
  } catch (err) {
    error.value = err?.message || 'Failed to load Cat Scoreboard'
  } finally {
    loading.value = false
  }
}

const causedDisplay = computed(() =>
  Number.isFinite(Number(data.value?.scoreboard?.causedEstimated))
    ? Number(data.value.scoreboard.causedEstimated).toFixed(2)
    : '0.00',
)
const preventedDisplay = computed(() =>
  Number.isFinite(Number(data.value?.scoreboard?.preventedEstimated))
    ? Number(data.value.scoreboard.preventedEstimated).toFixed(2)
    : '0.00',
)

const thisWeek = computed(() => Number(data.value?.weekly?.thisWeekContained || 0))
const lastWeek = computed(() => Number(data.value?.weekly?.lastWeekContained || 0))
const maxBar = computed(() => Math.max(thisWeek.value, lastWeek.value, 1))
const thisWeekWidth = computed(() => `${Math.round((thisWeek.value / maxBar.value) * 100)}%`)
const lastWeekWidth = computed(() => `${Math.round((lastWeek.value / maxBar.value) * 100)}%`)
const thisWeekBetter = computed(() => thisWeek.value >= lastWeek.value)
const weeklyReady = computed(() => Boolean(data.value?.weekly?.hasAtLeastOneWeek))
const updatedAtText = computed(() => {
  const iso = data.value?.updatedAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
})

const catProfileLine = computed(() => {
  const suburb = data.value?.user?.suburbName || 'Unknown suburb'
  const sexRaw = String(data.value?.user?.catSex || '').toUpperCase()
  const sex = sexRaw === 'M' ? 'male' : sexRaw === 'F' ? 'female' : 'male'
  const age = Number(data.value?.user?.catAgeYears || 0)
  return `${suburb} · ${age > 0 ? `${age}-year-old` : '-'} ${sex} outdoor cat`
})

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

const scheduleLine = computed(() => {
  const mo = formatTime(data.value?.schedule?.morningOut)
  const mi = formatTime(data.value?.schedule?.morningIn)
  const eo = formatTime(data.value?.schedule?.eveningOut)
  const ei = formatTime(data.value?.schedule?.eveningIn)
  if (!mo || !mi || !eo || !ei) return 'Schedule unavailable'
  return `${mo}-${mi} · ${eo}-${ei}`
})

onMounted(async () => {
  await fetchScoreboard()
  timer = setInterval(fetchScoreboard, 10000)
  window.addEventListener('focus', fetchScoreboard)
  document.addEventListener('visibilitychange', fetchScoreboard)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', fetchScoreboard)
  document.removeEventListener('visibilitychange', fetchScoreboard)
})
</script>

<template>
  <section class="scoreboard-page">
    <div class="scoreboard-shell">
      <header class="page-head">
        <p class="crumb">Cat's Scoreboard</p>
        <h1>Cat's Scoreboard</h1>
        <p>Track this month's encounters, prevention progress, and weekly containment trend for Cat.</p>
      </header>

      <section class="scoreboard-grid single">
        <article class="scoreboard-card">
          <p class="card-label">Cat's scoreboard</p>
          <h2>Cat - this month</h2>
          <p class="score-sub">{{ catProfileLine }}</p>
          <p class="schedule">Schedule: {{ scheduleLine }}</p>

          <div class="duo-grid">
            <div class="duo danger">
              <strong>{{ causedDisplay }}</strong>
              <span>Encounters caused</span>
              <small>{{ data?.scoreboard?.roamingEvenings || 0 }} roaming evenings × prey-per-day estimate.</small>
            </div>
            <div class="duo safe">
              <strong>{{ preventedDisplay }}</strong>
              <span>Prevented by you</span>
              <small>{{ data?.scoreboard?.containedEvenings || 0 }} contained evenings × prey-per-day estimate.</small>
            </div>
          </div>

          <section class="weekly-card">
            <h3>Contained evenings - this week vs last week</h3>
            <div v-if="weeklyReady" class="week-row">
              <div>
                <span>This week</span>
                <p>{{ thisWeek }} evenings</p>
              </div>
              <div class="line-bar"><i class="this" :style="{ width: thisWeekWidth }" /></div>
            </div>
            <div v-if="weeklyReady" class="week-row">
              <div>
                <span>Last week</span>
                <p>{{ lastWeek }} evenings</p>
              </div>
              <div class="line-bar"><i class="last" :style="{ width: lastWeekWidth }" /></div>
            </div>
            <p v-if="weeklyReady" class="week-note" :class="{ down: !thisWeekBetter }">
              {{ thisWeekBetter ? 'Great work: this week is on track or better.' : 'This week is currently below last week.' }}
            </p>
            <p v-else class="week-note">Need at least one full week of logs to compare trends.</p>
          </section>

          <article class="sighting-box">
            <h4>Want to explore further?</h4>
            <p>Read Our Mission to understand the purpose and data behind CatWatch.</p>
            <div class="links-row">
              <RouterLink to="/vision-mission">Read Our Mission →</RouterLink>
            </div>
          </article>
        </article>
      </section>

      <p v-if="updatedAtText" class="updated">Updated: {{ updatedAtText }}</p>
      <p v-if="loading" class="status">Refreshing live data...</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.scoreboard-page {
  min-height: calc(100dvh - 90px);
  background: #f3f4f2;
  padding: 14px;
}

.scoreboard-shell {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  border: 1px solid #d8ddd8;
  background: #f9faf9;
}

.page-head {
  padding: 18px 18px 14px;
  border-bottom: 1px solid #e2e5e2;
}

.crumb {
  color: #7a827d;
  font-size: 0.82rem;
}

.page-head h1 {
  margin-top: 4px;
  color: #1f2e27;
  font-size: 2rem;
  font-weight: 800;
}

.page-head p {
  margin-top: 6px;
  color: #5d6a63;
}

.scoreboard-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.scoreboard-card {
  border: 1px solid #dde2dd;
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.card-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #7b837f;
  font-size: 1.03rem;
  font-weight: 700;
}

.scoreboard-card h2 {
  margin-top: 8px;
  font-size: 1.7rem;
  color: #1f2f27;
  font-weight: 800;
}

.score-sub {
  color: #6d7771;
  margin-top: 3px;
  font-size: 0.9rem;
}

.schedule {
  margin-top: 3px;
  color: #4f6258;
  font-weight: 700;
  font-size: 0.9rem;
}

.duo-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.duo {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #dee3de;
}

.duo.danger {
  background: #fff1f1;
  border-color: #efc8c8;
}

.duo.safe {
  background: #eef8ee;
  border-color: #cce6cf;
}

.duo strong {
  font-size: 2rem;
  line-height: 1;
  color: #1f3d2f;
}

.duo span {
  display: block;
  margin-top: 5px;
  font-weight: 700;
  color: #30453a;
}

.duo small {
  display: block;
  margin-top: 4px;
  color: #63726a;
  font-size: 0.8rem;
}

.weekly-card {
  margin-top: 14px;
  border: 1px solid #e2e6e2;
  border-radius: 12px;
  padding: 12px;
  background: #fbfcfb;
}

.weekly-card h3 {
  margin: 0;
  font-size: 1.12rem;
  color: #2f3f36;
}

.week-row {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 10px;
}

.week-row span {
  color: #6a746f;
  font-size: 0.95rem;
}

.week-row p {
  margin: 2px 0 0;
  color: #2f3f36;
  font-weight: 700;
  font-size: 1.02rem;
}

.line-bar {
  height: 12px;
  border-radius: 999px;
  background: #ebefeb;
  overflow: hidden;
}

.line-bar i {
  display: block;
  height: 100%;
}

.line-bar .this {
  background: #32834d;
}

.line-bar .last {
  background: #b7c1ba;
}

.week-note {
  margin: 10px 0 0;
  color: #2f7646;
  font-size: 0.98rem;
  font-weight: 700;
}

.week-note.down {
  color: #a83c3c;
}

.sighting-box {
  margin-top: 12px;
  border: 1px solid #e2e6e2;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  margin-left: auto;
  width: fit-content;
  max-width: 100%;
}

.sighting-box h4 {
  margin: 0;
  color: #2b3d33;
}

.sighting-box p {
  margin: 5px 0 0;
  color: #65726b;
  font-size: 0.9rem;
}

.links-row {
  margin-top: 8px;
  display: block;
}

.sighting-box a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: #1d6b3c;
  border: 1px solid #2a7e4b;
  color: #f5fbf7;
  text-decoration: none;
  font-weight: 800;
  font-size: 0.95rem;
  box-shadow: 0 3px 8px rgba(16, 69, 38, 0.2);
}

.sighting-box a:hover {
  background: #1a6036;
}

.updated,
.status,
.error {
  margin: 0 16px 16px;
  font-size: 0.86rem;
}

.updated,
.status {
  color: #5d6d63;
}

.error {
  color: #a12f2f;
}

@media (max-width: 980px) {
  .page-head h1 {
    font-size: 1.55rem;
  }

  .week-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .duo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
