<template>
  <section class="mission-page">
    <div class="mission-shell">
      <section class="hero">
        <article class="hero-left">
          <p class="eyebrow">Promise of the earth - CatWatch</p>
          <h1>
            The wildlife is there.
            <br />
            The data is clear.
            <br />
            Now it's visible.
          </h1>
          <p>
            Millions of native animals are affected every year by pet cats. CatWatch translates that hidden cost into
            evidence local owners can act on.
          </p>
        </article>

        <article class="hero-stats">
          <div>
            <strong>377M</strong>
            <p>Native animals estimated to be killed by pet cats in Australia each year.</p>
          </div>
          <div>
            <strong>79.4%</strong>
            <p>Of households that own cats are in suburban or peri-urban communities.</p>
          </div>
          <div>
            <strong>39%</strong>
            <p>Of owned domestic cats are allowed to roam outside by owners.</p>
          </div>
        </article>
      </section>

      <section class="section two-col">
        <article class="panel">
          <p class="label">Our mission</p>
          <h2>To make the hidden wildlife impact of roaming pet cats visible, empowering suburban Victorian cat owners to take meaningful action through data-driven tools.</h2>
          <p>
            We connect everyday pet ownership to real ecological data via interactive maps and live impact dashboards,
            helping owners in suburban Victoria understand how their cats interact with locally threatened native species
            and giving them the tools to change their behaviour.
          </p>
        </article>
        <article class="panel">
          <p class="label">Our vision</p>
          <h2>A suburban Victoria where every cat owner understands their pet's ecological footprint, and chooses to protect it.</h2>
          <p>
            We envision a future where data-driven tools close the gap between pet love and wildlife conservation where
            no threatened Victorian species is silently lost because its neighborhood cats go unmonitored.
          </p>
        </article>
      </section>

      <section class="section">
        <p class="label">The problem we solve</p>
        <h2>Why CatWatch exists</h2>
        <div class="card-grid three">
          <article class="card">
            <h3>The invisible impact</h3>
            <p>Pet cats hunt native wildlife, often without owner awareness.</p>
          </article>
          <article class="card">
            <h3>Why it matters</h3>
            <p>Roaming behaviour affects vulnerable species near homes and reserves.</p>
          </article>
          <article class="card">
            <h3>Our approach</h3>
            <p>Local data, plain language insights, and practical evening containment goals.</p>
          </article>
        </div>
      </section>

      <section class="section values-section">
        <p class="label">What we stand for</p>
        <h2>Core values</h2>
        <div class="card-grid five">
          <article class="value-card">
            <div class="value-icon">📊</div>
            <h3>Data transparency</h3>
            <p>Every number shows its source. No black boxes, no vague claims.</p>
          </article>
          <article class="value-card">
            <div class="value-icon">💪</div>
            <h3>Owner empowerment</h3>
            <p>We give owners evidence, not lectures. The choice to act is theirs.</p>
          </article>
          <article class="value-card">
            <div class="value-icon">📍</div>
            <h3>Local conservation</h3>
            <p>No national averages. Every score is specific to your postcode.</p>
          </article>
          <article class="value-card">
            <div class="value-icon">🔁</div>
            <h3>Behavioural change</h3>
            <p>We design for the moment where data becomes a decision.</p>
          </article>
          <article class="value-card">
            <div class="value-icon">🦜</div>
            <h3>Native species protection</h3>
            <p>Victorian threatened species are the reason CatWatch exists.</p>
          </article>
        </div>
      </section>

      <section class="end-cta">
        <h2>How might we help pet owners reduce wildlife harm without asking them to choose between their cat and conservation?</h2>
        <RouterLink to="/risk-map">Start with your suburb →</RouterLink>
      </section>
    </div>
  </section>
</template>

<style scoped>
.mission-page {
  min-height: calc(100dvh - 90px);
  background: #f1f3f0;
  padding: 14px;
}

.mission-shell {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  border: 1px solid #d7ddd7;
  background: #fafbfa;
}

.hero {
  background: linear-gradient(145deg, #155f35 0%, #145632 42%, #114b2d 100%);
  color: #edf5ef;
  padding: 26px;
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1rem;
  color: #cae8d1;
  font-weight: 700;
}

.hero-left h1 {
  margin-top: 8px;
  font-size: 3rem;
  line-height: 1.08;
  font-weight: 800;
}

.hero-left p {
  margin-top: 12px;
  color: #d6e8db;
  max-width: 620px;
}

.hero-stats {
  display: grid;
  gap: 10px;
}

.hero-stats div {
  border: 1px solid rgba(216, 237, 219, 0.25);
  border-radius: 12px;
  background: rgba(23, 83, 48, 0.48);
  padding: 12px;
}

.hero-stats strong {
  font-size: 2rem;
  line-height: 1;
}

.hero-stats p {
  margin-top: 6px;
  color: #d2e4d7;
}

.section {
  padding: 24px 20px;
  border-bottom: 1px solid #e0e4e0;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6f7772;
  font-size: 1rem;
  font-weight: 700;
}

.section h2 {
  margin-top: 6px;
  color: #1e2e27;
  font-size: 2rem;
  font-weight: 800;
}

.panel {
  border: 1px solid #dde3dd;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}

.panel h2 {
  margin-top: 7px;
  font-size: 1.48rem;
}

.panel p {
  color: #5e6d65;
}

.card-grid {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.card-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.card-grid.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.card-grid.five {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.card {
  border: 1px solid #dde3dd;
  border-radius: 12px;
  background: #fff;
  padding: 14px;
}

.card h3 {
  margin: 0;
  color: #23352c;
  font-size: 1.08rem;
}

.card p {
  margin-top: 7px;
  color: #5f6e66;
}

.source {
  background: #fbfcfb;
}

.values-section {
  background: #fbfcfb;
}

.value-card {
  border: 1px solid #dfe5df;
  border-radius: 12px;
  background: #ffffff;
  padding: 14px;
}

.value-icon {
  font-size: 1.15rem;
  line-height: 1;
}

.value-card h3 {
  margin: 9px 0 0;
  color: #24372e;
  font-size: 1.05rem;
}

.value-card p {
  margin: 7px 0 0;
  color: #5f6e66;
  font-size: 0.9rem;
}

.end-cta {
  background: linear-gradient(140deg, #10492b 0%, #155f35 100%);
  color: #eef5ef;
  padding: 22px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.end-cta h2 {
  margin: 0;
  font-size: 1.4rem;
  max-width: 860px;
}

.end-cta a {
  text-decoration: none;
  color: #123f2a;
  background: #68e892;
  border-radius: 999px;
  padding: 9px 14px;
  font-weight: 800;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .hero,
  .two-col,
  .card-grid.three,
  .card-grid.four,
  .card-grid.five,
  .end-cta {
    grid-template-columns: 1fr;
  }

  .hero-left h1 {
    font-size: 2.2rem;
  }

  .section h2 {
    font-size: 1.56rem;
  }

  .end-cta {
    display: grid;
  }
}
</style>
