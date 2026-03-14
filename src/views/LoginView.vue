<template>
  <main class="login-shell">
    <section class="login-card" aria-labelledby="login-title">
      <h1 id="login-title" class="login-title">Sign in</h1>
      <p class="login-subtitle">Enter your credentials to access Sun Safety Awareness.</p>

      <form class="login-form" @submit.prevent="onSubmit">
        <label class="login-label" for="username">Username</label>
        <input
          id="username"
          v-model.trim="username"
          class="login-input"
          type="text"
          autocomplete="username"
          required
        />

        <label class="login-label" for="password">Password</label>
        <input
          id="password"
          v-model="password"
          class="login-input"
          type="password"
          autocomplete="current-password"
          required
        />

        <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

        <button class="login-button" type="submit">Sign in</button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import isAuthenticated, { setAuthenticated } from '@/authenticate'

const username = ref('')
const password = ref('')
const errorMessage = ref('')

const router = useRouter()
const route = useRoute()

const onSubmit = async () => {
  errorMessage.value = ''

  if (username.value === 'sunsafety' && password.value === '1234') {
    setAuthenticated(true)

    const redirectTo = typeof route.query.redirect === 'string' ? route.query.redirect : '/Home'
    await router.replace(redirectTo)
    return
  }

  isAuthenticated.value = false
  errorMessage.value = 'Incorrect username or password.'
}
</script>

<style scoped>
.login-shell {
  min-height: calc(100vh - 40px);
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 460px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  padding: 28px;
}

.login-title {
  font-size: 1.5rem;
  margin: 0;
}

.login-subtitle {
  margin: 8px 0 20px;
  color: rgba(15, 23, 42, 0.7);
}

.login-form {
  display: grid;
  gap: 12px;
}

.login-label {
  font-weight: 600;
}

.login-input {
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  padding: 10px 12px;
  font-size: 1rem;
}

.login-input:focus {
  outline: none;
  border-color: rgba(2, 132, 199, 0.65);
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
}

.login-button {
  margin-top: 8px;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  background: #0ea5e9;
  color: #ffffff;
  cursor: pointer;
}

.login-button:hover {
  background: #0284c7;
}

.login-error {
  margin: 0;
  color: #b91c1c;
  font-weight: 600;
}
</style>
