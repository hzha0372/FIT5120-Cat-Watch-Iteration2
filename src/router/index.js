import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'
import HomeView from '../views/HomeView.vue'
import HomeDashboardView from '../views/HomeDashboardView.vue'
import VisionMissionView from '../views/VisionMissionView.vue'

const routes = [
  {
    path: '/',
    component: HomeView,
  },
  {
    path: '/risk-map',
    component: CatWatchMapView,
  },
  {
    path: '/impact-score',
    component: HomeDashboardView,
  },
  {
    path: '/vision-mission',
    component: VisionMissionView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
