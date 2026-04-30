<script setup>
import { computed, onMounted, ref } from 'vue'

const loading = ref(false)
const error = ref('')
const payload = ref(null)

const formatNumber = (value, digits = 0) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const topTen = computed(() => payload.value?.topTen || [])
const userRow = computed(() => payload.value?.userRow || null)
const percentileLabel = computed(() => payload.value?.percentileLabel || '')
const updatedNote = computed(() => payload.value?.updatedNote || 'Rankings updated every Monday morning.')
const userInTopTen = computed(() => topTen.value.some((row) => row.isUserSuburb))

const fetchLeaderboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/community-leaderboard')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Failed to load guardian leaderboard.')
    payload.value = data
  } catch (err) {
    error.value = err?.message || 'Failed to load guardian leaderboard.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchLeaderboard)
</script>

<template>
  <main class="cw-page leaderboard-page">
    <div class="cw-container">
      <header class="leader-header">
        <h1 class="cw-page-title">Live Suburb Leaderboard</h1>
        <p class="cw-page-subtitle">Community containment rate ranking across Victorian suburbs this month.</p>
        <p v-if="percentileLabel" class="percentile-pill">{{ percentileLabel }}</p>
      </header>

      <p v-if="loading" class="status-line">Loading leaderboard...</p>
      <p v-if="error" class="error-line">{{ error }}</p>

      <section class="cw-card rank-card" v-if="topTen.length">
        <header class="rank-head">
          <h2>Top 10 Suburbs</h2>
          <p>Ordered by containment rate (highest to lowest).</p>
        </header>

        <div class="rank-list">
          <article
            v-for="row in topTen"
            :key="`${row.postcode}-${row.rank}`"
            class="rank-row"
            :class="{ 'user-row': row.isUserSuburb }"
          >
            <div class="left">
              <strong>#{{ row.rank }}</strong>
            </div>
            <div class="mid">
              <h3>{{ row.suburbName }}</h3>
              <small v-if="row.isUserSuburb" class="you-live">you live here</small>
              <p>Postcode: {{ row.postcode }}</p>
            </div>
            <div class="right">
              <strong>{{ formatNumber(row.containmentRatePct, 2) }}%</strong>
              <span>{{ formatNumber(row.encountersPrevented, 2) }} estimated encounters prevented</span>
            </div>
          </article>
        </div>
      </section>

      <section class="cw-card your-suburb" v-if="userRow && !userInTopTen">
        <h2>Your suburb</h2>
        <article class="rank-row user-row">
          <div class="left">
            <strong>#{{ userRow.rank }}</strong>
          </div>
          <div class="mid">
            <h3>{{ userRow.suburbName }}</h3>
            <small class="you-live">you live here</small>
            <p>Postcode: {{ userRow.postcode }}</p>
          </div>
          <div class="right">
            <strong>{{ formatNumber(userRow.containmentRatePct, 2) }}%</strong>
            <span>{{ formatNumber(userRow.encountersPrevented, 2) }} estimated encounters prevented</span>
          </div>
        </article>
      </section>

      <p class="updated-note">{{ updatedNote }}</p>
    </div>
  </main>
</template>

<style scoped>
.leaderboard-page { padding-top: 20px; }
.leader-header { margin-bottom: 20px; }
.percentile-pill {
  display: inline-block;
  margin-top: 10px;
  border: 1px solid #86efac;
  background: #ecfdf5;
  color: #166534;
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 800;
}
.status-line, .error-line { margin: 0 0 18px; font-weight: 700; }
.error-line {
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f2;
  color: #b91c1c;
  padding: 10px 12px;
}
.rank-card { overflow: hidden; }
.rank-head {
  padding: 20px 22px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(90deg, #ecfdf5, #f0fdfa);
}
.rank-head h2 { margin: 0; }
.rank-head p { margin: 6px 0 0; color: #4b5563; }
.rank-list { display: grid; }
.rank-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 280px;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.rank-row:last-child { border-bottom: 0; }
.user-row { border-left: 5px solid #22c55e; }
.left strong { font-size: 1.2rem; color: #0f172a; }
.mid h3 { margin: 0; color: #0f172a; }
.mid p { margin: 6px 0 0; color: #475569; }
.you-live {
  display: inline-block;
  margin-top: 5px;
  border: 1px solid #86efac;
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 800;
  color: #15803d;
  background: #f0fdf4;
}
.right { text-align: right; }
.right strong { display: block; font-size: 1.8rem; color: #dc2626; font-weight: 900; }
.right span { display: block; margin-top: 6px; color: #334155; font-weight: 700; font-size: 0.9rem; }
.your-suburb { margin-top: 18px; padding: 18px; }
.your-suburb h2 { margin: 0 0 10px; }
.updated-note { margin-top: 16px; color: #475569; font-weight: 700; }
@media (max-width: 900px) {
  .rank-row { grid-template-columns: 56px minmax(0, 1fr); }
  .right { grid-column: 1 / -1; text-align: left; }
}
</style>
