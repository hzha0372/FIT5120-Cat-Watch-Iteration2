<script setup>
import { RouterLink } from 'vue-router'

const catName = 'Cat'
</script>

<template>
  <section class="home-page">
    <div class="home-shell">
      <section class="hero-grid">
        <article class="hero-main">
          <h1>
            {{ catName }} came home.
            <br />
            <span>Now every log counts.</span>
          </h1>
          <p>
            While {{ catName }} was outside this morning, threatened species were active within 5km of your home.
            See exactly which ones - and what you can do about it.
          </p>
          <RouterLink to="/risk-map" class="btn-primary">Show me what's out there →</RouterLink>
        </article>
      </section>

      <section class="section-block">
        <p class="section-label">How CatWatch works</p>
        <h3>Four steps to understanding {{ catName }}'s impact</h3>
        <div class="card-grid four">
          <article class="info-card">
            <span class="step">1</span>
            <h4>See what's near you</h4>
            <p>Open threatened species records near your suburb, grouped by conservation status.</p>
            <RouterLink to="/risk-map">Open Risk Map →</RouterLink>
          </article>
          <article class="info-card">
            <span class="step">2</span>
            <h4>Measure suburb impact</h4>
            <p>Check your local pet cat impact score, source-backed components, and LGA ranking.</p>
            <RouterLink to="/impact-score">View Impact Score →</RouterLink>
          </article>
          <article class="info-card">
            <span class="step">3</span>
            <h4>Check your scoreboard</h4>
            <p>Review caused vs prevented estimates and weekly containment change over time.</p>
            <RouterLink to="/cat-scoreboard">View Scoreboard →</RouterLink>
          </article>
          <article class="info-card">
            <span class="step">4</span>
            <h4>Understand the bigger picture</h4>
            <p>Learn why these local choices matter for wildlife, and how CatWatch helps turn insight into action.</p>
            <RouterLink to="/vision-mission">Read Our Mission →</RouterLink>
          </article>
        </div>
      </section>

      <section class="section-block alt">
        <p class="section-label">Explore</p>
        <h3>Where do you want to start?</h3>
        <div class="card-grid four">
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
  border-bottom: 1px solid #d7ddd7;
}

.hero-main {
  background: linear-gradient(145deg, #166338 0%, #135a33 40%, #0f4f2d 100%);
  color: #eef5f0;
  min-height: 300px;
  padding: 42px 46px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-main h1 {
  margin-top: 0;
  font-size: 3rem;
  line-height: 1.1;
  font-weight: 800;
}

.hero-main h1 span {
  color: #7ef0a7;
}

.hero-main p {
  margin-top: 14px;
  max-width: 720px;
  color: #d7e8db;
  font-size: 1.03rem;
}

.btn-primary {
  margin-top: 18px;
  display: inline-block;
  width: 50%;
  text-decoration: none;
  color: #123d28;
  background: #59e087;
  border: 1px solid #63e78f;
  border-radius: 10px;
  padding: 11px 16px;
  font-weight: 800;
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

.card-grid.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

@media (max-width: 1180px) {
  .card-grid.four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .card-grid.three,
  .card-grid.four {
    grid-template-columns: 1fr;
  }

  .hero-main {
    min-height: 260px;
    padding: 32px 24px;
  }

  .hero-main h1 {
    font-size: 2.35rem;
  }

  .btn-primary {
    width: fit-content;
    max-width: 100%;
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
