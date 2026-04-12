import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'
import HomeDashboardView from '../views/HomeDashboardView.vue'

const routes = [
  {
    path: '/',
    component: HomeDashboardView,
  },
  {
    path: '/risk-map',
    component: CatWatchMapView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
