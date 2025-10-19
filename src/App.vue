<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import isAuthenticated from '@/authenticate'

const router = useRouter()
const logout = () => {
  isAuthenticated.value = false
  router.push('/FireLogin')
}
</script>

<template>
  <div>
    <!-- Navbar -->
    <header class="navbar bg-light px-3" role="navigation" aria-label="Main navigation">
      <a class="navbar-brand">Youth Mental Health</a>
      <nav class="nav-links">
        <router-link to="/" class="nav-link">Home</router-link>
        <router-link to="/FireLogin" class="nav-link">Firebase Login</router-link>
        <router-link to="/FireRegister" class="nav-link">Firebase Register</router-link>
        <button v-if="isAuthenticated" class="nav-link" @click="logout">Logout</button>
        <router-link to="/BulkEmail" class="nav-link">Bulk Email</router-link>
        <router-link to="/FeedbackAPI" class="nav-link">FeedbackAPI</router-link>
        <router-link to="/GeminiChat" class="nav-link">Gemini Chat</router-link>
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
