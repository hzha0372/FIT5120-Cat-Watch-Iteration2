import { createRouter, createWebHistory } from 'vue-router'
import CatWatchMapView from '../views/CatWatchMapView.vue'
import HomeView from '../views/HomeView.vue'
import HomeDashboardView from '../views/HomeDashboardView.vue'
import VisionMissionView from '../views/VisionMissionView.vue'
import LoginView from '../views/LoginView.vue'
import { isAuthenticated } from '../utils/auth'

const routes = [
  {
    path: '/login',
    component: LoginView,
    meta: { public: true },
  },
  {
    path: '/',
    component: HomeView,
    meta: { requiresAuth: true },
  },
  {
    path: '/risk-map',
    component: CatWatchMapView,
    meta: { requiresAuth: true },
  },
  {
    path: '/impact-score',
    component: HomeDashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/vision-mission',
    component: VisionMissionView,
    meta: { requiresAuth: true },
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

// Global route guard for auth access control and redirects. | 功能：全局路由守卫，控制登录态访问与重定向
router.beforeEach((to) => {
  const authed = isAuthenticated()

  if (to.meta.public && authed) {
    return '/'
  }

  if (to.meta.requiresAuth && !authed) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

export default router
