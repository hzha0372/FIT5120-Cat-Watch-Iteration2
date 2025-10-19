<template>
  <div style="max-width: 1000px; margin: 24px auto">
    <h2 style="text-align: center; margin-bottom: 24px">Admin Dashboard</h2>

    <section
      style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px"
    >
      <div class="card">
        <h4>Total Users</h4>
        <p>{{ totals.users ?? '—' }}</p>
      </div>
      <div class="card">
        <h4>Teens</h4>
        <p>{{ totals.teens ?? '—' }}</p>
      </div>
      <div class="card">
        <h4>Doctors</h4>
        <p>{{ totals.doctors ?? '—' }}</p>
      </div>
      <div class="card">
        <h4>Admins</h4>
        <p>{{ totals.admins ?? '—' }}</p>
      </div>
    </section>

    <div style="margin-top: 60px">
      <h3 style="text-align: center; margin-bottom: 16px">User Role Distribution</h3>
      <UserRoleChart />
    </div>
  </div>
</template>

<script>
import { collection, getDocs } from 'firebase/firestore'
import db from '@/firebase/init'
import UserRoleChart from '@/components/UserRoleChart.vue'

export default {
  name: 'AdminDashboard',
  components: { UserRoleChart },
  data() {
    return {
      totals: {
        users: 0,
        teens: 0,
        doctors: 0,
        admins: 0,
      },
    }
  },
  async mounted() {
    try {
      const us = await getDocs(collection(db, 'users'))
      const rows = us.docs.map((d) => d.data())
      this.totals.users = rows.length
      this.totals.teens = rows.filter((r) => r.role === 'teen').length
      this.totals.doctors = rows.filter((r) => r.role === 'doctor').length
      this.totals.admins = rows.filter((r) => r.role === 'admin').length
    } catch (e) {
      console.error('Error loading user data:', e)
    }
  },
}
</script>

<style scoped>
.card {
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  text-align: center;
  background-color: #fafafa;
}
.card h4 {
  margin-bottom: 6px;
  color: #333;
}
.card p {
  font-size: 1.4rem;
  font-weight: bold;
  color: #007bff;
}
</style>
