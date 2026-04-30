import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'
import HomeView from '../views/HomeView.vue'
import CatImpactScoreView from '../views/CatImpactScoreView.vue'
import CatScoreboardView from '../views/CatScoreboardView.vue'
import VisionMissionView from '../views/VisionMissionView.vue'
import PhotoIdentifierView from '../views/PhotoIdentifierView.vue'
import LoginView from '../views/LoginView.vue'
import GuardianLeaderboardView from '../views/GuardianLeaderboardView.vue'
import { isAuthenticated } from '../utils/auth'

// Central route table for the CatWatch single page app.
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
    meta: { requiresAuth: true },
  },
  {
    path: '/cat-scoreboard',
    // Preserve old dashboard URLs while exposing the restored Cat's Scoreboard route.
    alias: ['/my-dashboard', '/dashboard'],
    component: CatScoreboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/guardian/leaderboard',
    component: GuardianLeaderboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    component: LoginView,
  },
  {
    path: '/photo-identifier',
    // Aliases keep old project URLs working while the visible navigation uses the current "Photo Identifier" label.
    alias: ['/sighting-reporter'],
    component: PhotoIdentifierView,
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

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

export default router
