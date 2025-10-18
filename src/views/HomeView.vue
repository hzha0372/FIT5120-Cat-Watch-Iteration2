<template>
  <div class="home-container">
    <div class="text-section">
      <h1>Welcome to Youth Mental Health Support</h1>
      <p>Provide resources and guidance for young people and their supporters.</p>
    </div>

    <div id="sidebar">
      Longitude: {{ location.center.lng.toFixed(4) }} | Latitude:
      {{ location.center.lat.toFixed(4) }} | Zoom: {{ location.zoom.toFixed(2) }}
      <button @click="resetLocation">Reset</button>
    </div>

    <Map v-model="location" />
  </div>
</template>

<script>
import Map from '@/components/Map.vue'

export default {
  components: { Map },
  data() {
    return {
      location: {
        center: { lng: 144.9631, lat: -37.8136 }, // Melbourne
        zoom: 12,
      },
    }
  },
  methods: {
    resetLocation() {
      this.location = {
        center: { lng: 144.9631, lat: -37.8136 },
        zoom: 12,
      }
    },
  },
}
</script>

<style>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.text-section {
  text-align: center;
  margin: 20px 0;
}
#sidebar {
  background-color: rgba(35, 55, 75, 0.9);
  color: #fff;
  padding: 6px 12px;
  font-family: monospace;
  z-index: 2;
  position: absolute;
  top: 10px;
  left: 10px;
  border-radius: 4px;
}
button {
  margin-left: 10px;
  padding: 4px 8px;
}
</style>
