<script setup>
import { ref } from 'vue'
import { login } from '../utils/auth'
import { authFallback } from '../utils/localAuthFallback'

defineProps({
  title: {
    type: String,
    default: 'Sign in required',
  },
  subtitle: {
    type: String,
    default: 'Please sign in to continue.',
  },
})

const emit = defineEmits(['success'])

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// Sign in from a protected-page inline panel through the shared Scoreboard auth action.
const handleLogin = async () => {
  error.value = ''
  if (!username.value.trim() || !password.value.trim()) {
    error.value = 'Please enter your email and password.'
    return
  }

  loading.value = true
  try {
    let payload = null
    try {
      const response = await fetch('/api/scoreboard?action=auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: username.value,
          password: password.value,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status >= 500) {
          payload = authFallback({
            action: 'login',
            email: username.value,
            password: password.value,
          })
        } else {
          throw new Error(body?.error || 'Unable to sign in.')
        }
      } else {
        payload = body
      }
    } catch {
      payload = authFallback({
        action: 'login',
        email: username.value,
        password: password.value,
      })
    }
    login(payload.user)
    emit('success')
  } catch (err) {
    error.value = err?.message || 'Unable to sign in right now. Please try again later.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="gate-wrap">
    <article class="gate-card">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
      <form @submit.prevent="handleLogin">
        <label>
          <span>Email Address</span>
          <input v-model="username" type="email" autocomplete="username" />
        </label>
        <label>
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="current-password" />
        </label>
        <button type="submit" :disabled="loading">{{ loading ? 'Signing in...' : 'Sign In' }}</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </article>
  </section>
</template>

<style scoped>
.gate-wrap {
  margin-top: 26px;
}

.gate-card {
  max-width: 560px;
  margin: 0 auto;
  border: 1px solid #d7e2da;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(16, 64, 39, 0.12);
  padding: 28px;
}

.gate-card h2 {
  margin: 0;
  color: #1f3d2f;
}

.gate-card > p {
  margin-top: 8px;
  color: #607467;
}

form {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
}

label span {
  color: #436353;
  font-weight: 700;
}

input {
  height: 46px;
  border-radius: 10px;
  border: 1px solid #ccddd2;
  padding: 0 12px;
}

button {
  margin-top: 6px;
  height: 46px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(90deg, #1b7a49, #0f766e);
  color: #fff;
  font-weight: 800;
}

.error {
  margin-top: 12px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b91c1c;
  border-radius: 10px;
  padding: 10px 12px;
  font-weight: 700;
}
</style>
