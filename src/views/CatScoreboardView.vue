<script setup>
import { computed, onMounted, ref } from 'vue'

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

const riskClass = (riskKey) => `risk-${riskKey || 'lower'}`

// Summary cards are derived from /api/cat-scoreboard, which aggregates
// suburb_scores and species_cache. The labels are UI text; all numbers come
// from the API payload so the page has no demo scoreboard metrics.
const stats = computed(() => [
  {
    label: 'Total Regions Tracked',
    value: formatNumber(data.value?.summary?.totalRegions),
    trend: `${data.value?.scope?.label || 'Victoria'} database rows`,
  },
  {
    label: 'Average Score',
    value: formatNumber(data.value?.summary?.averageScore, 1),
    trend: `Max ${formatNumber(data.value?.summary?.maxScore, 1)} from suburb_scores`,
  },
  {
    label: 'Threatened Records',
    value: formatNumber(data.value?.summary?.threatenedRecords),
    trend: `${formatNumber(data.value?.summary?.threatenedSpecies)} species cached`,
  },
])

const criteria = computed(() =>
  (data.value?.criteria || []).map((item) => [item.label, `${Math.round(Number(item.weightPct || 0))}%`]),
)

// Load the statewide scoreboard once for the page. The API intentionally does
// not use a default user, so the frontend never decides which suburb should be
// highlighted or ranked.
const fetchScoreboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/cat-scoreboard')
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
        <h1 class="cw-page-title">Cat Impact Scoreboard</h1>
        <p class="cw-page-subtitle">
          Regional rankings based on conservation efforts and environmental impact metrics
        </p>
      </header>

      <p v-if="loading" class="status-line">Loading database scoreboard...</p>
      <p v-if="error" class="error-line">{{ error }}</p>

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
            <span aria-hidden="true">♕</span>
            <h2>Top Rankings</h2>
          </header>

          <!-- Ranking rows are real Victoria rows returned by the API, not local examples. -->
          <div class="ranking-list">
            <article
              v-for="row in rankingRows"
              :key="row.postcode"
              class="ranking-row"
              :class="[riskClass(row.risk?.key), { highlighted: row.rank <= 3 }]"
            >
              <div class="rank-badge" :class="row.rank === 1 ? 'gold' : row.rank === 2 ? 'silver' : row.rank === 3 ? 'bronze' : 'plain'">
                {{ row.rank <= 3 ? '♕' : `#${row.rank}` }}
              </div>
              <div class="rank-copy">
                <h3>{{ row.suburbName }}</h3>
                <p>
                  Postcode: {{ row.postcode }} • {{ formatNumber(row.roamingCats) }} cats •
                  {{ formatNumber(row.wildlifeRecords) }} wildlife records
                </p>
              </div>
              <div class="rank-score">
                <strong>{{ formatNumber(row.score, 1) }}</strong>
                <span>{{ row.risk?.label || 'Impact score' }}</span>
              </div>
            </article>
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
                <!-- Bars reuse the same database rows as Top Rankings for visual consistency. -->
                <i
                  v-for="row in distributionRows"
                  :key="`${row.postcode}-bar`"
                  :class="riskClass(row.risk?.key)"
                  :style="{ height: `${Math.max(2, Math.min(100, Number(row.score || 0)))}%` }"
                >
                  <span>{{ row.postcode }}</span>
                </i>
              </div>
            </div>
          </section>

          <section class="cw-card cw-card-pad">
            <h2 class="side-heading">Scoring Criteria</h2>
            <dl class="criteria-list">
              <div v-for="[label, value] in criteria" :key="label">
                <dt>{{ label }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="topRow" class="award-card">
            <span>🏆</span>
            <h2>Top Performer Award</h2>
            <p>
              {{ topRow.suburbName }} leads the Victoria database ranking with an impact score of
              {{ formatNumber(topRow.score, 1) }} from suburb_scores.
            </p>
          </section>
        </aside>
      </section>
    </div>
  </main>
</template>

<style scoped>
.scoreboard-header {
  margin-bottom: 32px;
}

.status-line,
.error-line {
  margin: -12px 0 24px;
  font-weight: 750;
}

.status-line {
  color: var(--cw-muted);
}

.error-line {
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f2;
  color: #b91c1c;
  padding: 12px 14px;
}

.stats-grid {
  margin-bottom: 32px;
}

.summary-card p {
  margin: 0;
  color: #4b5563;
  font-size: 1.03rem;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: var(--cw-text);
  font-size: 2.05rem;
  line-height: 1;
  font-weight: 900;
}

.summary-card span {
  display: block;
  margin-top: 14px;
  color: var(--cw-emerald);
  font-size: 0.95rem;
}

.scoreboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(310px, 0.95fr);
  gap: 32px;
  align-items: start;
}

.ranking-panel {
  overflow: hidden;
}

.ranking-panel > header {
  min-height: 78px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid var(--cw-border);
  background: linear-gradient(90deg, #ecfdf5, #f0fdfa);
  padding: 24px;
}

.ranking-panel > header span {
  color: var(--cw-emerald);
  font-size: 1.7rem;
}

.ranking-panel h2,
.side-heading {
  margin: 0;
  color: var(--cw-text);
  font-size: 1.28rem;
  line-height: 1.2;
  font-weight: 850;
}

.ranking-list {
  display: grid;
}

.ranking-row {
  min-height: 109px;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #f3f4f6;
  padding: 24px;
}

.ranking-row:last-child {
  border-bottom: 0;
}

.ranking-row.highlighted {
  background: linear-gradient(90deg, #f9fafb, #ffffff);
}

.ranking-row.risk-high {
  border-left: 4px solid #ef4444;
}

.ranking-row.risk-medium {
  border-left: 4px solid #f59e0b;
}

.ranking-row.risk-lower {
  border-left: 4px solid #22c55e;
}

.rank-badge {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 1.25rem;
  font-weight: 900;
}

.rank-badge.gold {
  background: #f6b300;
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(245, 158, 11, 0.22);
}

.rank-badge.silver {
  background: #c7ced8;
  color: #374151;
}

.rank-badge.bronze {
  background: #ff680a;
  color: #ffffff;
}

.rank-copy h3 {
  margin: 0;
  color: var(--cw-text);
  font-size: 1.15rem;
  font-weight: 850;
}

.rank-copy small {
  margin-left: 6px;
  font-size: 0.9rem;
}

.rank-copy p {
  margin: 8px 0 0;
  color: var(--cw-muted);
  font-size: 0.95rem;
}

.rank-score {
  min-width: 58px;
  text-align: right;
}

.rank-score strong {
  display: block;
  color: var(--cw-emerald);
  font-size: 2rem;
  line-height: 1;
  font-weight: 900;
}

.ranking-row.risk-high .rank-score strong {
  color: #dc2626;
}

.ranking-row.risk-medium .rank-score strong {
  color: #d97706;
}

.ranking-row.risk-lower .rank-score strong {
  color: #16a34a;
}

.rank-score span {
  display: block;
  margin-top: 8px;
  font-size: 0.9rem;
  font-weight: 800;
}

.up {
  color: #16a34a;
}

.score-side {
  display: grid;
  gap: 24px;
}

.chart {
  height: 244px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  margin-top: 26px;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  color: #6b7280;
  font-size: 0.78rem;
  padding-bottom: 20px;
}

.bar-area {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: end;
  gap: 8px;
  border-left: 2px solid #9ca3af;
  border-bottom: 2px solid #9ca3af;
  padding: 0 8px 20px;
}

.bar-area i {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 9px 9px 0 0;
  background: #10b981;
  min-height: 18px;
  font-style: normal;
}

.bar-area i.risk-high {
  background: linear-gradient(180deg, #ef4444, #dc2626);
}

.bar-area i.risk-medium {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.bar-area i.risk-lower {
  background: linear-gradient(180deg, #22c55e, #16a34a);
}

.bar-area i span {
  position: absolute;
  bottom: -20px;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 800;
}

.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed #e5e7eb;
}

.grid-line.one {
  top: 0;
}

.grid-line.two {
  top: 25%;
}

.grid-line.three {
  top: 50%;
}

.grid-line.four {
  top: 75%;
}

.criteria-list {
  margin: 20px 0 0;
  display: grid;
  gap: 14px;
}

.criteria-list div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.criteria-list dt {
  color: #374151;
}

.criteria-list dd {
  margin: 0;
  color: var(--cw-text);
  font-weight: 850;
}

.award-card {
  border-radius: var(--cw-card-radius);
  background: linear-gradient(135deg, #10b981, #0d9488);
  color: #ffffff;
  padding: 24px;
}

.award-card span {
  font-size: 2rem;
}

.award-card h2 {
  margin: 20px 0 0;
  font-size: 1.22rem;
  font-weight: 850;
}

.award-card p {
  margin: 14px 0 0;
  max-width: 270px;
  line-height: 1.5;
}

@media (max-width: 1040px) {
  .scoreboard-layout {
    grid-template-columns: 1fr;
  }
}
</style>
