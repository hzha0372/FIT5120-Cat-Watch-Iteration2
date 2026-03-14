<script setup>
import { useRouter } from 'vue-router'
import isAuthenticated, { clearAuthentication } from '@/authenticate'

const router = useRouter()

const logout = async () => {
  clearAuthentication()
  await router.replace('/Login')
}
</script>

<template>
  <div>
    <!-- Navbar -->
    <header
      v-if="isAuthenticated"
      class="navbar bg-light px-3"
      role="navigation"
      aria-label="Main navigation"
    >
      <a class="navbar-brand">Sun Safety Awareness</a>
      <nav class="nav-links">
        <router-link to="/Home" class="nav-link">Home</router-link>
        <button class="nav-link" type="button" @click="logout">Logout</button>
      </nav>
    </header>

    <!-- Router View -->
    <main style="margin-top: 20px">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.navbar-brand {
  font-weight: bold;
}

.nav-links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.nav-link {
  text-decoration: none;
  color: #000;
  font-weight: 500;
}

.nav-link:hover,
button.nav-link:hover {
  color: #007bff;
}

button.nav-link {
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
}

@media (max-width: 768px) {
  .nav-links {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
