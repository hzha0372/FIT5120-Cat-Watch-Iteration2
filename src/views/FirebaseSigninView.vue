<template>
  <div style="width: 350px; margin: 50px auto">
    <h2 style="margin-bottom: 20px">Sign in</h2>

    <form @submit.prevent="submitForm">
      <!-- Email -->
      <div style="margin-bottom: 20px">
        <label for="signinEmail">Email:</label><br />
        <input id="signinEmail" type="text" v-model="email" style="width: 100%; padding: 5px" />
        <p v-if="emailError" style="color: red; margin: 5px 0 0" aria-live="polite">
          {{ emailError }}
        </p>
      </div>

      <!-- Password -->
      <div style="margin-bottom: 20px">
        <label for="signinPassword">Password:</label><br />
        <input
          id="signinPassword"
          type="password"
          v-model="password"
          style="width: 100%; padding: 5px"
        />
        <p v-if="passwordError" style="color: red; margin: 5px 0 0" aria-live="polite">
          {{ passwordError }}
        </p>
      </div>

      <button type="submit" style="margin-top: 20px; padding: 5px 15px">Sign in</button>
    </form>

    <!-- Signed in Users Table -->
    <div style="margin-top: 50px" v-if="users.length > 0">
      <h3>Signed in Users</h3>
      <DataTable :value="users" aria-label="Signed in users table">
        <Column field="email" header="Email"></Column>
        <Column field="password" header="Password"></Column>
        <Column field="role" header="Role"></Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'vue-router'
import db from '@/firebase/init'
import { collection, getDocs } from 'firebase/firestore'
import isAuthenticated from '@/authenticate'

const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const users = ref([])

const auth = getAuth()
const router = useRouter()

const submitForm = async () => {
  emailError.value = ''
  passwordError.value = ''

  if (email.value === '') emailError.value = 'Please enter your email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
    emailError.value = 'Please enter a valid email address.'

  if (password.value === '') passwordError.value = 'Please enter your password.'

  if (emailError.value === '' && passwordError.value === '') {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value)
      const userEmail = userCredential.user.email
      const snap = await getDocs(collection(db, 'users'))
      const allUsers = snap.docs.map((d) => d.data())
      const currentUser = allUsers.find((u) => u.email === userEmail)

      if (!currentUser) {
        alert('User not found in Firestore.')
        return
      }

      const role = currentUser.role || 'teen'
      localStorage.setItem('userRole', role)
      isAuthenticated.value = true

      users.value.push({
        email: email.value,
        password: password.value,
        role: role,
      })

      if (role === 'admin') router.push('/AdminDashboard')
      else if (role === 'staff') router.push('/StaffPage')
      else router.push('/TeenPage')
    } catch (err) {
      console.error('Sign in failed:', err)
      alert('Sign in failed: ' + err.message)
    }
  } else {
    alert('Sign in failed, please fill in the correct information.')
  }
}
</script>
