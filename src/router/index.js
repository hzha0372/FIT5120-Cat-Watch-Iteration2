import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'
import HomeView from '../views/HomeView.vue'
import CatImpactScoreView from '../views/CatImpactScoreView.vue'
import CatScoreboardView from '../views/CatScoreboardView.vue'
import VisionMissionView from '../views/VisionMissionView.vue'

// Central route table for the CatWatch single-page app.
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
    component: CatImpactScoreView,
  },
  {
    path: '/cat-scoreboard',
    // Preserve old dashboard URLs while exposing the restored Cat's Scoreboard route.
    alias: ['/my-dashboard', '/dashboard'],
    component: CatScoreboardView,
  },
  {
    path: '/about',
    alias: ['/vision-mission'],
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
