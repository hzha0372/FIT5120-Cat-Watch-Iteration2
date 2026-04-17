<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { credentialsMatch, login } from '../utils/auth'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const canSubmit = computed(() => {
  return String(username.value).trim().length > 0 && String(password.value).trim().length > 0
})

// Handle login form submit and redirect flow.
const handleLogin = async () => {
  error.value = ''

  if (!canSubmit.value) {
    error.value = 'Please enter username and password.'
    return
  }

  loading.value = true

  await new Promise((resolve) => setTimeout(resolve, 220))

  if (!credentialsMatch(username.value, password.value)) {
    error.value = 'Invalid username or password. Please try again.'
    loading.value = false
    return
  }

  login()

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.replace(redirect)
}
</script>

<template>
  <section class="login-page">
    <div class="login-layout">
      <article class="welcome-panel">
        <p class="chip">CAT WATCH SECURE ACCESS</p>
        <h1>Welcome back, Daniel.</h1>
        <p>
          Sign in to access the live dashboard, risk map, and Simba's impact insights.
        </p>
        <div class="feature-list">
          <div class="feature-item">
            <strong>Live Species Risk</strong>
            <span>Map nearby threatened wildlife activity in your suburb.</span>
          </div>
          <div class="feature-item">
            <strong>Simba's Scoreboard</strong>
            <span>Track caused and prevented encounters with weekly trends.</span>
          </div>
          <div class="feature-item">
            <strong>Mission Insights</strong>
            <span>Connect everyday cat care to broader conservation outcomes.</span>
          </div>
        </div>
      </article>

      <article class="form-panel">
        <p class="panel-kicker">Login Required</p>
        <h2>Sign in to continue</h2>

        <form class="login-form" @submit.prevent="handleLogin">
          <label>
            <span>Username</span>
            <input v-model="username" type="text" autocomplete="username" placeholder="Enter username" />
          </label>

          <label>
            <span>Password</span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter password"
            />
          </label>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <button class="login-btn" type="submit" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Login to CatWatch' }}
          </button>
        </form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.login-page {
  min-height: calc(100dvh - 20px);
  padding: 16px;
  background:
    radial-gradient(circle at 15% 10%, rgba(126, 228, 168, 0.3), transparent 42%),
    radial-gradient(circle at 90% 85%, rgba(88, 188, 126, 0.18), transparent 35%),
    linear-gradient(135deg, #f4f8f3 0%, #eef4ef 42%, #e6eee8 100%);
}

.login-layout {
  max-width: 1240px;
  min-height: calc(100dvh - 52px);
  margin: 0 auto;
  border: 1px solid #d0dad0;
  display: grid;
  grid-template-columns: 1.2fr 0.9fr;
  background: #fbfdfb;
  box-shadow: 0 16px 40px rgba(28, 49, 37, 0.08);
}

.welcome-panel {
  padding: 34px;
  background: linear-gradient(150deg, #0f4f2e 0%, #136138 48%, #1a6d43 100%);
  color: #e6f6eb;
}

.chip {
  display: inline-block;
  background: rgba(235, 251, 239, 0.16);
  border: 1px solid rgba(230, 250, 236, 0.3);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.welcome-panel h1 {
  margin-top: 22px;
  font-size: 2.8rem;
  line-height: 1.08;
}

.welcome-panel > p {
  margin-top: 14px;
  max-width: 520px;
  color: #cce7d4;
  font-size: 1.03rem;
}

.feature-list {
  margin-top: 26px;
  display: grid;
  gap: 10px;
}

.feature-item {
  border: 1px solid rgba(202, 231, 211, 0.26);
  background: rgba(226, 245, 232, 0.08);
  padding: 12px;
  border-radius: 12px;
}

.feature-item strong {
  display: block;
  font-size: 1rem;
}

.feature-item span {
  display: block;
  margin-top: 2px;
  color: #cde9d5;
  font-size: 0.92rem;
}

.form-panel {
  padding: 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background:
    linear-gradient(180deg, rgba(243, 250, 245, 0.92), rgba(238, 246, 240, 0.94)),
    radial-gradient(circle at 100% 0%, rgba(67, 163, 102, 0.17), transparent 46%);
}

.panel-kicker {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.78rem;
  font-weight: 800;
  color: #557062;
}

.form-panel h2 {
  margin-top: 8px;
  color: #183727;
  font-size: 2rem;
}

.login-form {
  margin-top: 18px;
  display: grid;
  gap: 13px;
}

.login-form label span {
  display: block;
  margin-bottom: 6px;
  color: #375646;
  font-weight: 700;
}

.login-form input {
  width: 100%;
  border: 1px solid #c4d1c5;
  border-radius: 10px;
  background: #fcfffc;
  padding: 11px 12px;
  color: #193226;
  font-size: 0.98rem;
  outline: none;
}

.login-form input:focus {
  border-color: #6fb086;
  box-shadow: 0 0 0 3px rgba(127, 196, 150, 0.2);
}

.error-msg {
  margin: 0;
  border: 1px solid #e8b2b2;
  background: #fff2f2;
  color: #8f2c2c;
  border-radius: 8px;
  padding: 8px 10px;
  font-weight: 600;
}

.login-btn {
  margin-top: 4px;
  border: 1px solid #50a36d;
  background: linear-gradient(180deg, #56c478 0%, #3fa660 100%);
  color: #f6fff9;
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 980px) {
  .login-layout {
    grid-template-columns: 1fr;
  }

  .welcome-panel,
  .form-panel {
    padding: 24px;
  }

  .welcome-panel h1 {
    font-size: 2.15rem;
  }
}
</style>
