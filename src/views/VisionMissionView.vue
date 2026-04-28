<script setup>
import { computed, onMounted, ref } from 'vue'

const loading = ref(false)
const error = ref('')
const data = ref(null)

// Fetch mission statistics from the database-backed API.
const fetchMissionStats = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/mission-stats')
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'Failed to load mission stats.')
    data.value = payload
  } catch (err) {
    error.value = err?.message || 'Failed to load mission stats.'
  } finally {
    loading.value = false
  }
}

const usersTracked = computed(() => Number(data.value?.coverage?.usersTracked || 0).toLocaleString())
const updatedAtText = computed(() => {
  const iso = data.value?.updatedAt
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
})

// These cards are the project's original mission content, not operational data.
// Numeric live coverage on this page is limited to usersTracked/updatedAtText,
// both loaded from /api/mission-stats.
const valueCards = [
  {
    title: 'Data transparency',
    description: 'Every number shows its source. No black boxes, no vague claims.',
    icon: 'Data',
    tone: 'cw-icon-blue',
  },
  {
    title: 'Owner empowerment',
    description: 'We give owners evidence, not lectures. The choice to act is theirs.',
    icon: 'People',
    tone: 'cw-icon-pink',
  },
  {
    title: 'Local conservation',
    description: 'No national averages. Every score is specific to your postcode.',
    icon: 'Local',
    tone: 'cw-icon-emerald',
  },
  {
    title: 'Behavioural change',
    description: 'We design for the moment where data becomes a decision.',
    icon: 'Action',
    tone: 'cw-icon-violet',
  },
  {
    title: 'Native species protection',
    description: 'Victorian threatened species are the reason CatWatch exists.',
    icon: 'Native',
    tone: 'cw-icon-emerald',
  },
  {
    title: 'Responsible ownership',
    description: 'We help owners reduce wildlife harm without choosing between their cat and conservation.',
    icon: 'Care',
    tone: 'cw-icon-blue',
  },
]

onMounted(fetchMissionStats)
</script>

<template>
  <main class="mission-prototype cw-page">
    <div class="cw-container-narrow">
      <header class="mission-hero cw-text-center">
        <h1>Our Vision &amp; Mission</h1>
      </header>

      <section class="cw-grid cw-grid-2 vision-grid">
        <article class="cw-card statement-card">
          <div class="statement-title">
            <span class="cw-icon-tile cw-icon-emerald">◎</span>
            <h2>Our Mission</h2>
          </div>
          <h3>
            To make the hidden wildlife impact of roaming pet cats visible, empowering suburban Victorian cat owners
            to take meaningful action through data-driven tools.
          </h3>
          <p>
            We connect everyday pet ownership to real ecological data via interactive maps and live impact dashboards,
            helping owners in suburban Victoria understand how their cats interact with locally threatened native
            species and giving them the tools to change their behaviour.
          </p>
          <p>Scope update: CatWatch has expanded from an initial Melbourne focus to statewide Victoria coverage.</p>
        </article>

        <article class="cw-card statement-card">
          <div class="statement-title">
            <span class="cw-icon-tile cw-icon-violet">⊙</span>
            <h2>Our Vision</h2>
          </div>
          <h3>
            A suburban Victoria where every cat owner understands their pet's ecological footprint, and chooses to protect it.
          </h3>
          <p>
            We envision a future where data-driven tools close the gap between pet love and wildlife conservation
            where no threatened Victorian species is silently lost because neighborhood cats go unmonitored.
          </p>
        </article>
      </section>

      <section class="problem-section">
        <h2>Why CatWatch Exists</h2>
        <p>
          Live database coverage: {{ usersTracked }} tracked users.
          <span v-if="updatedAtText"> Updated: {{ updatedAtText }}</span>
        </p>
        <div class="cw-grid cw-grid-3">
          <article class="cw-card cw-card-pad mini-card">
            <h3>The invisible impact</h3>
            <p>Pet cats hunt native wildlife, often without owner awareness.</p>
          </article>
          <article class="cw-card cw-card-pad mini-card">
            <h3>Why it matters</h3>
            <p>Roaming behaviour affects vulnerable species near homes and reserves.</p>
          </article>
          <article class="cw-card cw-card-pad mini-card">
            <h3>Our approach</h3>
            <p>Local data, plain language insights, and practical evening containment goals.</p>
          </article>
        </div>
      </section>

      <section class="values-section">
        <h2>Core Values</h2>
        <div class="values-grid">
          <article v-for="item in valueCards" :key="item.title" class="cw-card value-card">
            <span class="cw-icon-tile value-icon" :class="item.tone">{{ item.icon }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </section>

      <section class="what-we-do">
        <h2>What We Do</h2>
        <p v-if="loading" class="status-line">Loading mission stats from database...</p>
        <p v-if="error" class="error-line">{{ error }}</p>
        <div class="action-grid">
          <article>
            <span>📊</span>
            <h3>Data transparency</h3>
            <p>Every CatWatch number comes from database tables and source-backed calculations.</p>
          </article>
          <article>
            <span>🔍</span>
            <h3>Local insight</h3>
            <p>Every score is specific to your postcode, not a broad national average.</p>
          </article>
          <article>
            <span>🤝</span>
            <h3>Behavioural change</h3>
            <p>We help owners reduce wildlife harm without choosing between their cat and conservation.</p>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.mission-hero {
  margin-bottom: 32px;
}

.mission-hero h1 {
  margin: 0;
  color: var(--cw-text);
  font-size: clamp(3rem, 6vw, 4.25rem);
  line-height: 1.1;
  font-weight: 900;
}

.vision-grid,
.problem-section,
.values-section {
  margin-bottom: 56px;
}

.statement-card {
  min-height: 300px;
  padding: 32px;
}

.statement-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.statement-title h2 {
  margin: 0;
  color: var(--cw-text);
  font-size: 1.6rem;
  font-weight: 900;
}

.statement-card h3 {
  margin: 26px 0 0;
  color: var(--cw-text);
  font-size: 1.35rem;
  line-height: 1.35;
}

.statement-card p {
  margin: 18px 0 0;
  color: #374151;
  font-size: 1.05rem;
  line-height: 1.6;
}

.problem-section > h2,
.values-section > h2,
.what-we-do > h2 {
  margin: 0 0 18px;
  text-align: center;
  color: var(--cw-text);
  font-size: clamp(2rem, 4vw, 2.6rem);
  line-height: 1.15;
  font-weight: 900;
}

.problem-section > p {
  margin: 0 0 28px;
  text-align: center;
  color: var(--cw-muted);
}

.mini-card h3,
.value-card h3 {
  margin: 0;
  color: var(--cw-text);
  font-size: 1.2rem;
}

.mini-card p,
.value-card p {
  margin: 12px 0 0;
  color: var(--cw-muted);
  line-height: 1.55;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.value-card {
  min-height: 204px;
  padding: 24px;
}

.value-icon {
  width: auto;
  min-width: 58px;
  padding: 0 10px;
  font-size: 0.82rem;
  text-transform: uppercase;
}

.value-card h3 {
  margin-top: 20px;
}

.what-we-do {
  border-radius: 24px;
  background: linear-gradient(135deg, #10b981, #0d9488);
  color: #ffffff;
  padding: 48px;
}

.what-we-do h2 {
  color: #ffffff;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  margin-top: 30px;
}

.action-grid article {
  text-align: center;
}

.action-grid span {
  font-size: 2.2rem;
}

.action-grid h3 {
  margin: 22px 0 0;
  font-size: 1.2rem;
  font-weight: 900;
}

.action-grid p {
  margin: 14px auto 0;
  max-width: 290px;
  font-size: 1rem;
  line-height: 1.55;
}

.status-line,
.error-line {
  margin: -10px 0 24px;
  text-align: center;
  font-weight: 800;
}

.error-line {
  color: #fee2e2;
}

@media (max-width: 880px) {
  .values-grid,
  .action-grid {
    grid-template-columns: 1fr;
  }

  .what-we-do {
    padding: 36px 20px;
  }
}
</style>
