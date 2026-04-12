<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const loading = ref(false)
const error = ref('')
const data = ref(null)
let timer = null

const fetchDashboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/impact-dashboard')
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load impact dashboard')
    }
    data.value = payload
  } catch (err) {
    error.value = err?.message || 'Failed to load impact dashboard'
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
const thisWeekHeight = computed(() => `${Math.round((thisWeek.value / maxBar.value) * 100)}%`)
const lastWeekHeight = computed(() => `${Math.round((lastWeek.value / maxBar.value) * 100)}%`)
const thisWeekBetter = computed(() => thisWeek.value >= lastWeek.value)
const weeklyReady = computed(() => Boolean(data.value?.weekly?.hasAtLeastOneWeek))
const updatedAtText = computed(() => {
  const iso = data.value?.updatedAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
})

onMounted(async () => {
  await fetchDashboard()
  timer = setInterval(fetchDashboard, 10000)
  window.addEventListener('focus', fetchDashboard)
  document.addEventListener('visibilitychange', fetchDashboard)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', fetchDashboard)
  document.removeEventListener('visibilitychange', fetchDashboard)
})
</script>

<template>
  <section class="home-page">
    <div class="dashboard-shell">
      <header class="hero">
        <h1>Home Dashboard</h1>
        <p>Live scoreboard from your real roaming log data.</p>
      </header>

      <section class="scoreboard">
        <article class="card card-caused">
          <h2>Estimated encounters caused</h2>
          <p class="big">{{ causedDisplay }}</p>
          <small>{{ data?.scoreboard?.roamingEvenings || 0 }} roaming evenings × daily prey rate</small>
        </article>

        <article class="card card-prevented">
          <h2>Prevented by you</h2>
          <p class="big">{{ preventedDisplay }}</p>
          <small>{{ data?.scoreboard?.containedEvenings || 0 }} indoor evenings × daily prey rate</small>
        </article>
      </section>

      <p class="note">
        {{ data?.preyRate?.note || 'Based on Cat Tracker data- suburban outdoor cats average 2 prey items per month.' }}
      </p>

      <div class="bottom-grid">
        <section class="week-card">
          <h3>Last week vs This week</h3>
          <div v-if="weeklyReady" class="bars">
            <div class="bar-col">
              <div class="bar last" :style="{ height: lastWeekHeight }" />
              <strong>{{ lastWeek }}</strong>
              <span>Last week</span>
            </div>
            <div class="bar-col">
              <div
                class="bar this"
                :class="{ down: !thisWeekBetter }"
                :style="{ height: thisWeekHeight }"
              />
              <strong>{{ thisWeek }}</strong>
              <span>This week</span>
            </div>
          </div>
          <p v-else class="week-empty">Need at least one week of roaming logs to show comparison.</p>
          <p v-if="weeklyReady" class="week-note">
            {{ thisWeekBetter ? 'This week is on track or better than last week.' : 'This week is below last week.' }}
          </p>
        </section>

        <section class="meta-card">
          <h3>Live Data</h3>
          <p>{{ data?.user?.name }} · {{ data?.user?.catName }}</p>
          <p v-if="updatedAtText" class="updated">Updated: {{ updatedAtText }}</p>
          <p v-if="loading" class="status">Refreshing live data...</p>
          <p v-if="error" class="error">{{ error }}</p>
        </section>
      </div>

    </div>
  </section>
</template>

<style scoped>
.home-page {
  min-height: calc(100dvh - 90px);
  background: linear-gradient(180deg, #e6ece7 0%, #f1f4f2 100%);
  padding: 14px;
}

.dashboard-shell {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  border-radius: 16px;
  border: 1px solid #cbd6cc;
  background: #f6f7f5;
  box-shadow: 0 10px 28px rgba(26, 64, 45, 0.12);
}

.hero {
  background: linear-gradient(90deg, #133d2b 0%, #1b4a32 70%, #245b3a 100%);
  color: #eff6f0;
  padding: 14px;
}

.hero h1 {
  font-size: 1.45rem;
  line-height: 1.1;
  font-weight: 800;
}

.hero p {
  margin-top: 6px;
  color: #d9e8dd;
  font-size: 0.95rem;
}

.scoreboard {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card {
  border-radius: 14px;
  padding: 12px;
  border: 1px solid #cfd8d0;
}

.card-caused {
  background: #fffefe;
}

.card-prevented {
  background: #f1f8f1;
  border-color: #b8d2ba;
}

.card h2 {
  font-size: 0.92rem;
  color: #5d6c64;
  font-weight: 700;
  min-height: 40px;
}

.big {
  margin-top: 4px;
  font-size: 2.2rem;
  line-height: 1;
  font-weight: 900;
  color: #133b2a;
}

.card small {
  display: block;
  margin-top: 7px;
  color: #67746d;
  font-size: 0.82rem;
  line-height: 1.3;
}

.note {
  margin: 0 12px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #c8d7c8;
  background: #edf5ea;
  color: #45604c;
  font-size: 0.86rem;
}

.week-card {
  margin: 0;
  background: #fff;
  border: 1px solid #d5ddd7;
  border-radius: 14px;
  padding: 12px;
}

.week-card h3 {
  font-size: 1.1rem;
  font-weight: 800;
  color: #254538;
}

.bars {
  margin-top: 10px;
  min-height: 168px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
  gap: 20px;
}

.bar-col {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.bar {
  width: 76px;
  min-height: 10px;
  border-radius: 10px 10px 6px 6px;
}

.bar.last {
  background: #c4cec7;
}

.bar.this {
  background: #57a962;
}

.bar.this.down {
  background: #e0be52;
}

.bar-col strong {
  font-size: 1.45rem;
  color: #223b31;
}

.bar-col span {
  color: #68756f;
  font-size: 0.95rem;
  font-weight: 700;
}

.week-note {
  margin-top: 10px;
  color: #4f625a;
  font-size: 0.93rem;
}

.week-empty {
  margin-top: 10px;
  color: #6d776f;
  font-size: 0.93rem;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f2f4f1;
  border: 1px dashed #cfd4cf;
}

.updated {
  font-size: 0.8rem;
  color: #6a7770;
}

.status {
  margin-top: 8px;
  color: #64746d;
  font-size: 0.86rem;
}

.error {
  margin-top: 8px;
  color: #a23030;
  background: #ffeaea;
  border: 1px solid #efb1b1;
  border-radius: 8px;
  padding: 10px;
}

.bottom-grid {
  margin: 12px;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

.meta-card {
  border: 1px solid #d5ddd7;
  border-radius: 14px;
  background: #ffffff;
  padding: 12px;
}

.meta-card h3 {
  font-size: 1.1rem;
  font-weight: 800;
  color: #254538;
}

.meta-card p {
  margin-top: 8px;
  color: #4e6059;
}

@media (max-width: 760px) {
  .home-page {
    padding: 8px;
  }

  .scoreboard {
    grid-template-columns: 1fr;
  }

  .bottom-grid {
    grid-template-columns: 1fr;
  }
}
</style>
