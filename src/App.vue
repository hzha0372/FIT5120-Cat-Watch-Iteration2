<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const logoMissing = ref(false)
const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <img
            v-if="!logoMissing"
            src="/images/catwatch-logo.png"
            alt="Cat Watch logo"
            @error="logoMissing = true"
          />
          <div class="brand-text">
            <h1>CAT WATCH</h1>
            <p>Protecting Wildlife, Responsible Pet Ownership</p>
          </div>
        </div>
        <nav class="top-nav">
          <RouterLink to="/" class="nav-pill" :class="{ active: route.path === '/' }">
            Home
          </RouterLink>
          <RouterLink
            to="/risk-map"
            class="nav-pill"
            :class="{ active: route.path.startsWith('/risk-map') }"
          >
            Risk Map
          </RouterLink>
          <RouterLink
            to="/impact-score"
            class="nav-pill"
            :class="{ active: route.path.startsWith('/impact-score') }"
          >
            Simba's Scoreboard
          </RouterLink>
          <RouterLink
            to="/vision-mission"
            class="nav-pill"
            :class="{ active: route.path.startsWith('/vision-mission') }"
          >
            Our Mission
          </RouterLink>
        </nav>
      </div>
    </header>

    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background: #f1f3f0;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 900;
  border-bottom: 1px solid #d5dbd4;
  background: rgba(249, 250, 248, 0.96);
  backdrop-filter: blur(6px);
}

.header-inner {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand img {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid #c5cec3;
}

.brand-text h1 {
  font-size: 2.1rem;
  line-height: 1.1;
  font-weight: 800;
  color: #133a29;
}

.brand-text p {
  margin-top: 4px;
  color: #557061;
  font-size: 1.02rem;
  font-weight: 700;
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-pill {
  text-decoration: none;
  font-weight: 700;
  font-size: 1.08rem;
  color: #3d5d4f;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 7px 12px;
}

.nav-pill:hover {
  border-color: #bfd0c1;
  background: #ecf2ec;
}

.nav-pill.active {
  color: #17462f;
  border-color: #a9c8af;
  background: #e5f1e7;
}

@media (max-width: 960px) {
  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .top-nav {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .brand img {
    width: 52px;
    height: 52px;
    border-radius: 12px;
  }

  .brand-text h1 {
    font-size: 1.45rem;
  }

  .brand-text p {
    font-size: 0.75rem;
  }
}
</style>
