<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, validateCredentials } from '../utils/auth'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const redirectTarget = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : '/',
)

const heroTitle = computed(() => {
  if (redirectTarget.value.startsWith('/impact-score')) return 'Welcome Back'
  if (redirectTarget.value.startsWith('/cat-scoreboard') || redirectTarget.value.startsWith('/my-dashboard') || redirectTarget.value.startsWith('/dashboard')) {
    return 'Welcome Back'
  }
  return 'Sign in to view Impact Score and Scoreboard'
})

const heroSubtitle = computed(() => {
  if (redirectTarget.value.startsWith('/impact-score')) return 'Continue your impact socre'
  if (redirectTarget.value.startsWith('/cat-scoreboard') || redirectTarget.value.startsWith('/my-dashboard') || redirectTarget.value.startsWith('/dashboard')) {
    return 'Continue your scoreborad'
  }
  return 'Use your team account to access protected analytics pages while keeping public pages open for visitors.'
})

const handleLogin = async () => {
  error.value = ''
  if (!username.value.trim() || !password.value.trim()) {
    error.value = 'Please enter your username and password.'
    return
  }

  loading.value = true
  try {
    login()
    const redirectTo = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirectTo)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <article class="login-hero">
        <div class="hero-logo-wrap" aria-hidden="true">
          <img class="hero-logo" src="/images/catwatch-logo.png" alt="" />
        </div>
        <p class="eyebrow">CatWatch Secure Access</p>
        <h1>{{ heroTitle }}</h1>
        <p>{{ heroSubtitle }}</p>
      </article>

      <article class="login-form-wrap">
        <h2>Login</h2>
        <form class="login-form" @submit.prevent="handleLogin">
          <label>
            <span>Username</span>
            <input v-model="username" type="text" autocomplete="username" placeholder="Enter username" />
          </label>
          <label>
            <span>Password</span>
            <input v-model="password" type="password" autocomplete="current-password" placeholder="Enter password" />
          </label>
          <button type="submit" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: calc(100dvh - 101px);
  background:
    radial-gradient(circle at 20% 15%, #c6f6d5 0%, transparent 45%),
    radial-gradient(circle at 80% 25%, #bae6fd 0%, transparent 40%),
    linear-gradient(140deg, #f6faf7 0%, #eef5f0 100%);
  padding: 24px 16px;
  display: grid;
  place-items: center;
}

.login-panel {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  border: 1px solid #d9e2db;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(21, 64, 43, 0.11);
  overflow: hidden;
  display: block;
}

.login-hero {
  padding: 36px 32px 26px;
  background: linear-gradient(150deg, #12452d 0%, #0f5a37 58%, #0f766e 100%);
  color: #effaf3;
  text-align: center;
  display: grid;
  justify-items: center;
}

.hero-logo-wrap {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: grid;
  place-items: center;
}

.hero-logo {
  width: 62px;
  height: 62px;
  object-fit: cover;
  border-radius: 14px;
}

.eyebrow {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 800;
}

.login-hero h1 {
  margin-top: 16px;
  font-size: 2rem;
  line-height: 1.2;
}

.login-hero p {
  margin-top: 14px;
  color: #d5efe0;
  max-width: 560px;
}

.login-form-wrap {
  padding: 30px 32px 34px;
  max-width: 540px;
  margin: 0 auto;
}

.login-form-wrap h2 {
  margin: 0;
  color: #1f3c2f;
  font-size: 1.6rem;
}

.login-form {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.login-form label {
  display: grid;
  gap: 7px;
}

.login-form span {
  color: #466454;
  font-weight: 700;
}

.login-form input {
  height: 48px;
  border-radius: 10px;
  border: 1px solid #cfe0d5;
  padding: 0 14px;
  font: inherit;
}

.login-form input:focus {
  outline: none;
  border-color: #1f7a4d;
  box-shadow: 0 0 0 3px rgba(31, 122, 77, 0.15);
}

.login-form button {
  margin-top: 8px;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(90deg, #1e7a4c, #0f766e);
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
}

.login-form button:disabled {
  cursor: wait;
  opacity: 0.75;
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

@media (max-width: 960px) {
  .login-hero {
    padding: 28px 24px;
  }

  .hero-logo-wrap {
    width: 84px;
    height: 84px;
  }

  .hero-logo {
    width: 54px;
    height: 54px;
  }

  .login-form-wrap {
    padding: 28px 24px;
  }
}
</style>

