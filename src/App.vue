<script setup>
import { ref } from 'vue'

const logoMissing = ref(false)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <img
          v-if="!logoMissing"
          src="/images/catwatch-logo.png"
          alt="Cat Watch logo"
          @error="logoMissing = true"
        />
        <div class="brand-text">
          <h1>Cat Watch</h1>
          <p>Protecting Wildlife, Responsible Pet Ownership</p>
        </div>
      </div>
    </header>

    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background: #f0f1ef;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 900;
  padding: 10px 14px;
  border-bottom: 1px solid #cad2c8;
  background: rgba(244, 247, 243, 0.95);
  backdrop-filter: blur(6px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand img {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid #c5cec3;
}

.brand-text h1 {
  font-size: 1.25rem;
  line-height: 1;
  font-weight: 800;
  color: #133a29;
}

.brand-text p {
  margin-top: 3px;
  color: #557061;
  font-size: 0.9rem;
}
</style>
