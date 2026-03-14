import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SunSafetyDashboard from '../views/SunSafetyDashboard.vue'
import AwarenessView from '../views/AwarenessView.vue'
import LoginView from '../views/LoginView.vue'
import AccessDenied from '../views/AccessDenied.vue'
import isAuthenticated from '@/authenticate'
const routes = [
  {
    path: '/',
    redirect: '/Login',
  },
  {
    path: '/Home',
    component: HomeView,
    alias: ['/home'],
    meta: { requiresAuth: true },
  },
  {
    path: '/SunSafety',
    component: SunSafetyDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/Awareness',
    component: AwarenessView,
    meta: { requiresAuth: true },
  },
  {
    path: '/Login',
    component: LoginView,
    alias: ['/login'],
  },
  {
    path: '/AccessDenied',
    component: AccessDenied,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth
  const requiredRole = to.meta.requiresRole
  const currentRole = localStorage.getItem('userRole')

  if (to.path.toLowerCase() === '/login' && isAuthenticated.value) {
    next('/Home')
    return
  }

  if (requiresAuth && !isAuthenticated.value) {
    next({ path: '/Login', query: { redirect: to.fullPath } })
    return
  }

  if (requiredRole && currentRole !== requiredRole) {
    next('/AccessDenied')
    return
  }

  next()
})

export default router
