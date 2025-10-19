<template>
  <div style="width: 700px; margin: 40px auto">
    <h2 style="margin-bottom: 20px">Bulk Email Sender</h2>

    <div v-if="users.length">
      <p>Select recipients:</p>

      <div
        v-for="(u, i) in users"
        :key="i"
        style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px"
      >
        <input type="checkbox" :id="u.email" v-model="selected" :value="u.email" />
        <label :for="u.email">{{ u.email }} ({{ u.role }})</label>
      </div>

      <div style="margin-top: 20px">
        <label for="subject">Subject:</label><br />
        <input
          id="subject"
          v-model="subject"
          placeholder="Enter subject"
          style="width: 100%; padding: 6px"
        />
      </div>

      <div style="margin-top: 20px">
        <label for="message">Message:</label><br />
        <textarea
          id="message"
          v-model="message"
          rows="4"
          placeholder="Enter message"
          style="width: 100%; padding: 6px"
        ></textarea>
      </div>

      <button @click="sendEmail" :disabled="loading" style="margin-top: 20px; padding: 8px 20px">
        {{ loading ? 'Sending...' : 'Send Bulk Email' }}
      </button>
    </div>

    <p v-else>Loading users...</p>

    <div v-if="result" style="margin-top: 20px; font-weight: 600">{{ result }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import db from '@/firebase/init'
import axios from 'axios'

const users = ref([])
const selected = ref([])
const subject = ref('Welcome to Youth Mental Health!')
const message = ref('We’re glad to have you join our community.')
const loading = ref(false)
const result = ref('')

const fetchUsers = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'))
    users.value = snap.docs.map((d) => d.data())
  } catch (err) {
    console.error('Failed to fetch users:', err)
  }
}

const sendEmail = async () => {
  if (selected.value.length === 0) {
    alert('Select at least one recipient.')
    return
  }
  loading.value = true
  try {
    const { data } = await axios.post(
      'https://us-central1-fit5032-assignment-27178.cloudfunctions.net/sendBulkEmail',
      {
        recipients: selected.value,
        subject: subject.value,
        message: message.value,
      },
    )
    result.value = `✅ Successfully sent to ${data.sent} recipients`
  } catch (e) {
    console.error(e)
    result.value = `❌ Error: ${e.message}`
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)
</script>
