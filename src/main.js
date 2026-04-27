import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'leaflet/dist/leaflet.css'
import './assets/main.css'

// Mount the Vue app with router support and shared global styles.
createApp(App).use(router).mount('#app')
