import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'

const routes = [
  {
    path: '/',
    component: CatWatchMapView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
