<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentUser } from '../utils/auth'

const loading = ref(false)
const error = ref('')
const data = ref(null)

const formatNumber = (value, digits = 0) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const rankingRows = computed(() => data.value?.ranking || [])
const distributionRows = computed(() => data.value?.distribution || rankingRows.value)
const topRow = computed(() => rankingRows.value[0] || null)
const personal = computed(() => data.value?.personal || null)
const guardian = computed(() => data.value?.guardian || null)
const leaderboardMeta = computed(() => data.value?.leaderboardMeta || null)

const criteria = computed(() =>
  (data.value?.criteria || []).map((item) => [item.label, `${Math.round(Number(item.weightPct || 0))}%`]),
)

const stats = computed(() => [
  {
    label: 'Participating Regions',
    value: formatNumber(data.value?.summary?.participatingRegions),
    trend: `${data.value?.scope?.label || 'Victoria'} database rows`,
  },
  {
    label: 'Contained Evenings (Month)',
    value: formatNumber(data.value?.summary?.totalContainedEvenings),
    trend: 'Live aggregate from roaming_log',
  },
  {
    label: 'Active Guardian Households',
    value: formatNumber(data.value?.summary?.activeGuardians),
    trend: 'Distinct users with indoor logs this month',
  },
])

// Load scoreboard data for the currently logged in user's postcode.
const fetchScoreboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const currentUser = getCurrentUser()
    const params = new URLSearchParams()
    // Use the registered user id/postcode instead of a fixed suburb.
    if (currentUser?.id) params.set('userId', String(currentUser.id))
    if (currentUser?.postcode) params.set('postcode', String(currentUser.postcode))

    if (!params.toString()) {
      throw new Error('Please sign in again so CatWatch can load your registered postcode.')
    }

    const response = await fetch(`/api/cat-scoreboard-data?${params.toString()}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load Cat Scoreboard.')
    data.value = payload
  } catch (err) {
    error.value = err?.message || 'Failed to load Cat Scoreboard.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchScoreboard)
</script>

<template>
  <main class="scoreboard-prototype cw-page">
    <div class="cw-container">
      <header class="scoreboard-header">
        <h1 class="cw-page-title">Neighbourhood Wildlife Guardian</h1>
        <p class="cw-page-subtitle">
          Personal streak, neighbourhood guardian score, and live suburb leaderboard
        </p>
      </header>

      <p v-if="loading" class="status-line">Loading database scoreboard...</p>
      <p v-if="error" class="error-line">{{ error }}</p>

      <section v-if="personal || guardian" class="cw-grid cw-grid-2 epic7-grid">
        <article v-if="personal" class="cw-card cw-card-pad epic7-card">
          <h2>Personal Containment Streak</h2>
          <p class="epic7-main">🔥 {{ personal.currentStreak }} consecutive evenings</p>
          <p>Best streak: {{ personal.bestStreak }} evenings</p>
          <p>This month: {{ personal.containedThisMonth }} contained, {{ personal.roamingThisMonth }} roaming</p>
          <p v-if="personal.currentStreak > 0">
            You have kept your cat inside for {{ personal.currentStreak }} evenings in a row - well done.
          </p>
          <p v-if="personal.currentStreak > 0">
            That is an estimated {{ formatNumber(personal.encountersPrevented, 2) }} wildlife encounters prevented - based on Cat Tracker SA prey rate data.
          </p>
          <p v-else-if="personal.streakBroken">Your streak ended - start a new one tonight.</p>
          <p v-else>Start your streak tonight - log your first contained evening.</p>
        </article>

        <article v-if="guardian" class="cw-card cw-card-pad epic7-card">
          <h2>Neighbourhood Guardian Score</h2>
          <p class="epic7-main">{{ formatNumber(guardian.encountersPrevented, 2) }}</p>
          <p>{{ guardian.suburbName }} {{ guardian.postcode }}</p>
          <p>
            {{ guardian.activeGuardianCount }} Guardian households contributed this month.
          </p>
          <p>
            Your {{ guardian.userContributionEvenings }} evenings contributed
            {{ formatNumber(guardian.userContributionEncounters, 2) }} prevented encounters.
          </p>
        </article>
      </section>

      <section class="cw-grid cw-grid-3 stats-grid" aria-label="Scoreboard summary">
        <article v-for="item in stats" :key="item.label" class="cw-card cw-card-pad summary-card">
          <p>{{ item.label }}</p>
          <strong>{{ item.value }}</strong>
          <span>{{ item.trend }}</span>
        </article>
      </section>

      <section class="scoreboard-layout">
        <article class="ranking-panel cw-card">
          <header>
            <span aria-hidden="true">TOP</span>
            <div>
              <h2>Live Suburb Leaderboard</h2>
              <p class="leaderboard-subtitle">Rankings based on conservation efforts and environmental impact metrics.</p>
            </div>
          </header>

          <div v-if="rankingRows.length" class="ranking-list">
            <article
              v-for="row in rankingRows"
              :key="`${row.postcode}-${row.rank}`"
              class="ranking-row"
              :class="{ highlighted: row.rank <= 3, 'user-suburb': row.isUserSuburb }"
            >
              <div class="rank-badge" :class="row.rank === 1 ? 'gold' : row.rank === 2 ? 'silver' : row.rank === 3 ? 'bronze' : 'plain'">
                {{ row.rank <= 3 ? 'TOP' : `#${row.rank}` }}
              </div>
              <div class="rank-copy">
                <h3>{{ row.suburbName }}</h3>
                <small v-if="row.isUserSuburb" class="you-live">you live here</small>
                <p>
                  Postcode: {{ row.postcode }} • {{ formatNumber(row.activeGuardianCount) }} guardians •
                  {{ formatNumber(row.containedEvenings) }} contained evenings
                </p>
                <p v-if="row.hasLowSample" class="sample-note">Early data: fewer than 3 active guardians this month.</p>
              </div>
              <div class="rank-score">
                <strong>{{ formatNumber(row.containmentRatePct, 1) }}</strong>
                <span>High impact</span>
              </div>
            </article>
          </div>

          <div v-else class="empty-board">
            No leaderboard rows yet for this month. Add indoor logs to populate rankings.
          </div>
        </article>

        <aside class="score-side">
          <section class="cw-card cw-card-pad">
            <h2 class="side-heading">Score Distribution</h2>
            <div class="chart" aria-label="Score distribution bar chart">
              <div class="y-axis">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>
              <div class="bar-area">
                <div class="grid-line one" />
                <div class="grid-line two" />
                <div class="grid-line three" />
                <div class="grid-line four" />
                <i
                  v-for="row in distributionRows"
                  :key="`${row.postcode}-bar`"
                  :style="{ height: `${Math.max(2, Math.min(100, Number(row.containmentRatePct || 0)))}%` }"
                >
                  <span>{{ row.postcode }}</span>
                </i>
              </div>
            </div>
          </section>

          <section class="cw-card cw-card-pad">
            <h2 class="side-heading">Ranking Formula</h2>
            <p class="formula-note">
              Containment rate = total_contained_evenings / (active_guardian_count x days_in_month x 1 evening per day baseline).
            </p>
            <dl class="criteria-list">
              <div v-for="[label, value] in criteria" :key="label">
                <dt>{{ label }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="topRow" class="award-card">
            <span>Top</span>
            <h2>Top Performer Award</h2>
            <p>
              {{ topRow.suburbName }} leads the Victoria ranking with a score of
              {{ formatNumber(topRow.containmentRatePct, 1) }}.
            </p>
          </section>
        </aside>
      </section>

      <p v-if="leaderboardMeta" class="updated-note">{{ leaderboardMeta.updatedNote }}</p>
    </div>
  </main>
</template>


<style scoped>
.scoreboard-header { margin-bottom: 32px; }
.status-line, .error-line { margin: -12px 0 24px; font-weight: 750; }
.status-line { color: var(--cw-muted); }
.error-line { border: 1px solid #fecaca; border-radius: 10px; background: #fff1f2; color: #b91c1c; padding: 12px 14px; }
.stats-grid { margin-bottom: 32px; }
.epic7-grid { margin-bottom: 24px; }
.epic7-card h2 { margin: 0; font-size: 1.2rem; }
.epic7-main { margin: 12px 0 8px; font-size: 2rem; font-weight: 900; color: var(--cw-emerald); }
.summary-card p { margin: 0; color: #4b5563; font-size: 1.03rem; }
.summary-card strong { display: block; margin-top: 8px; color: var(--cw-text); font-size: 2.05rem; line-height: 1; font-weight: 900; }
.summary-card span { display: block; margin-top: 14px; color: var(--cw-emerald); font-size: 0.95rem; }
.scoreboard-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(310px, 0.95fr); gap: 32px; align-items: start; }
.ranking-panel { overflow: hidden; }
.ranking-panel > header { min-height: 78px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--cw-border); background: linear-gradient(90deg, #ecfdf5, #f0fdfa); padding: 24px; }
.ranking-panel > header span { color: #0f766e; font-size: 1.1rem; font-weight: 900; }
.ranking-panel h2, .side-heading { margin: 0; color: var(--cw-text); font-size: 1.28rem; line-height: 1.2; font-weight: 850; }
.leaderboard-subtitle { margin: 6px 0 0; color: var(--cw-muted); font-size: 0.92rem; }
.ranking-list { display: grid; }
.ranking-row { min-height: 109px; display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 16px; border-bottom: 1px solid #f3f4f6; padding: 24px; }
.ranking-row:last-child { border-bottom: 0; }
.ranking-row.highlighted { background: linear-gradient(90deg, #f9fafb, #ffffff); }
.ranking-row.user-suburb { border-left: 4px solid #ef4444; }
.rank-badge { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 999px; background: #f3f4f6; color: #4b5563; font-size: 0.9rem; font-weight: 900; }
.rank-badge.gold { background: #f6b300; color: #ffffff; }
.rank-badge.silver { background: #c7ced8; color: #374151; }
.rank-badge.bronze { background: #ff680a; color: #ffffff; }
.rank-copy h3 { margin: 0; color: var(--cw-text); font-size: 1.15rem; font-weight: 850; }
.rank-copy p { margin: 8px 0 0; color: var(--cw-muted); font-size: 0.95rem; }
.sample-note { margin-top: 6px; color: #92400e; font-size: 0.82rem; font-weight: 700; }
.you-live { display: inline-block; margin-top: 6px; border-radius: 999px; background: #ecfdf5; color: #047857; padding: 3px 10px; border: 1px solid #86efac; font-weight: 800; }
.rank-score { min-width: 86px; text-align: right; }
.rank-score strong { display: block; color: #dc2626; font-size: 3rem; line-height: 1; font-weight: 900; }
.rank-score span { display: block; margin-top: 8px; font-size: 1.1rem; color: #111827; font-weight: 900; }
.empty-board { padding: 28px 24px; color: #4b5563; font-weight: 700; }
.score-side { display: grid; gap: 24px; }
.chart { height: 244px; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; margin-top: 26px; }
.y-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; color: #6b7280; font-size: 0.78rem; padding-bottom: 20px; }
.bar-area { position: relative; display: flex; flex-wrap: nowrap; align-items: flex-end; gap: 8px; border-left: 2px solid #9ca3af; border-bottom: 2px solid #9ca3af; padding: 0 8px 20px; overflow-x: auto; overflow-y: hidden; }
.bar-area i { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: center; border-radius: 9px 9px 0 0; background: linear-gradient(180deg, #ef4444, #dc2626); min-height: 18px; font-style: normal; min-width: 44px; flex: 0 0 44px; }
.bar-area i span { position: absolute; bottom: -20px; color: #6b7280; font-size: 0.72rem; font-weight: 800; }
.grid-line { position: absolute; left: 0; right: 0; border-top: 1px dashed #e5e7eb; }
.grid-line.one { top: 0; }
.grid-line.two { top: 25%; }
.grid-line.three { top: 50%; }
.grid-line.four { top: 75%; }
.criteria-list { margin: 20px 0 0; display: grid; gap: 14px; }
.criteria-list div { display: flex; justify-content: space-between; gap: 14px; }
.criteria-list dt { color: #374151; }
.criteria-list dd { margin: 0; color: var(--cw-text); font-weight: 850; }
.formula-note { margin: 10px 0 0; color: #475569; line-height: 1.45; }
.award-card { border-radius: var(--cw-card-radius); background: linear-gradient(135deg, #10b981, #0d9488); color: #ffffff; padding: 24px; }
.award-card span { font-size: 1.1rem; font-weight: 900; }
.award-card h2 { margin: 20px 0 0; font-size: 1.22rem; font-weight: 850; }
.award-card p { margin: 14px 0 0; max-width: 270px; line-height: 1.5; }
.updated-note { margin-top: 18px; color: var(--cw-muted); font-weight: 700; }
@media (max-width: 1040px) { .scoreboard-layout { grid-template-columns: 1fr; } }
</style>
