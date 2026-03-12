import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FirebaseSigninView from '../views/FirebaseSigninView.vue'
import FirebaseRegisterView from '../views/FirebaseRegisterView.vue'
import SunSafetyDashboard from '../views/SunSafetyDashboard.vue'
import DoctorPage from '@/views/DoctorPage.vue'
import FeedbackAPI from '@/views/FeedbackAPI.vue'
import AccessDenied from '@/views/AccessDenied.vue'
import isAuthenticated from '@/authenticate'
import BulkEmail from '@/views/BulkEmail.vue'
import AdminDashboard from '@/views/AdminDashboard.vue'
const routes = [
  {
    path: '/',
    redirect: '/SunSafety',
  },
  {
    path: '/Home',
    component: HomeView,
    alias: ['/home'],
  },
  {
    path: '/FireLogin',
    component: FirebaseSigninView,
  },
  {
    path: '/FireRegister',
    component: FirebaseRegisterView,
  },
  {
    path: '/SunSafety',
    component: SunSafetyDashboard,
  },
  {
    path: '/DoctorPage',
    component: DoctorPage,
  },
  {
    path: '/FeedbackAPI',
    component: FeedbackAPI,
    meta: { requiresAuth: true },
  },
  {
    path: '/BulkEmail',
    component: BulkEmail,
    meta: { requiresAuth: true },
  },
  {
    path: '/AdminDashboard',
    component: AdminDashboard,
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

  if (requiresAuth && !isAuthenticated.value) {
    next('/AccessDenied')
    return
  }

  if (requiredRole && currentRole !== requiredRole) {
    next('/AccessDenied')
    return
  }

  next()
})

export default router
