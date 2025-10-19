<template>
  <div style="width: 900px; margin: 50px auto">
    <h2 style="margin-bottom: 20px; text-align: center">Feedbacks</h2>

    <!-- Feedback Form -->
    <form @submit.prevent="submitFeedback" class="program-form">
      <div class="form-row">
        <label for="participantName">Participant Name:</label>
        <input id="participantName" type="text" v-model="newFeedback.participantName" />
      </div>
      <p v-if="participantNameError" class="error-text" aria-live="polite">
        {{ participantNameError }}
      </p>

      <div class="form-row">
        <label for="programName">Program Name:</label>
        <input id="programName" type="text" v-model="newFeedback.programName" />
      </div>
      <p v-if="programNameError" class="error-text" aria-live="polite">{{ programNameError }}</p>

      <div class="form-row">
        <label for="rating">Rating:</label>
        <select id="rating" v-model="newFeedback.rating">
          <option value="" disabled>Select rating</option>
          <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <p v-if="ratingError" class="error-text" aria-live="polite">{{ ratingError }}</p>

      <div class="form-row">
        <label for="feedbackText">Feedback:</label>
        <input id="feedbackText" type="text" v-model="newFeedback.feedback" />
      </div>
      <p v-if="feedbackError" class="error-text" aria-live="polite">{{ feedbackError }}</p>

      <div style="text-align: center">
        <button type="submit" class="submit-btn">Add Feedback</button>
      </div>
    </form>

    <!-- Feedback DataTable -->
    <DataTable
      :value="filteredFeedbacks"
      paginator
      :rows="10"
      responsiveLayout="scroll"
      sortMode="single"
      class="p-datatable-gridlines"
      ref="dt"
      aria-label="Feedbacks table"
    >
      <template #header>
        <div class="text-end pb-4">
          <Button
            icon="pi pi-external-link"
            label="Export CSV"
            @click="exportCSV"
            class="mr-2"
            aria-label="Export CSV"
          />
          <Button
            icon="pi pi-file-pdf"
            label="Export PDF"
            @click="exportPDF"
            aria-label="Export PDF"
          />
        </div>
      </template>

      <Column field="participantName" header="Participant Name" sortable>
        <template #header>
          <InputText
            v-model="filters.participantName"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
            aria-label="Search Participant Name"
          />
        </template>
      </Column>

      <Column field="programName" header="Program Name" sortable>
        <template #header>
          <InputText
            v-model="filters.programName"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
            aria-label="Search Program Name"
          />
        </template>
      </Column>

      <Column field="rating" header="Rating" sortable>
        <template #header>
          <InputText
            v-model="filters.rating"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
            aria-label="Search Rating"
          />
        </template>
      </Column>

      <Column field="feedback" header="Feedback" sortable>
        <template #header>
          <InputText
            v-model="filters.feedback"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
            aria-label="Search Feedback"
          />
        </template>
      </Column>
    </DataTable>

    <!-- 📊 Firestore D3 Bar Chart -->
    <div style="margin-top: 40px">
      <h3 style="text-align: center; margin-bottom: 16px">Average Rating by Program</h3>
      <FirestoreBarChart ref="chartRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import FirestoreBarChart from '@/components/FirestoreBarChart.vue'

const feedbacks = ref([])
const newFeedback = ref({ participantName: '', programName: '', rating: '', feedback: '' })
const participantNameError = ref('')
const programNameError = ref('')
const ratingError = ref('')
const feedbackError = ref('')
const chartRef = ref(null) //

const filters = reactive({ participantName: '', programName: '', rating: '', feedback: '' })
const filteredFeedbacks = computed(() =>
  feedbacks.value.filter(
    (f) =>
      (!filters.participantName ||
        f.participantName.toLowerCase().includes(filters.participantName.toLowerCase())) &&
      (!filters.programName ||
        f.programName.toLowerCase().includes(filters.programName.toLowerCase())) &&
      (!filters.rating || f.rating.toString().includes(filters.rating)) &&
      (!filters.feedback || f.feedback.toLowerCase().includes(filters.feedback.toLowerCase())),
  ),
)

const fetchFeedbacks = async () => {
  try {
    const res = await fetch(
      'https://us-central1-fit5032-assignment-27178.cloudfunctions.net/getFeedbacks',
    )
    feedbacks.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch feedbacks:', err)
  }
}

const submitFeedback = async () => {
  participantNameError.value = programNameError.value = ratingError.value = feedbackError.value = ''

  if (!newFeedback.value.participantName.trim())
    participantNameError.value = 'Participant Name is required.'
  if (!newFeedback.value.programName.trim()) programNameError.value = 'Program Name is required.'
  if (!newFeedback.value.rating.toString().trim()) ratingError.value = 'Rating is required.'
  if (!newFeedback.value.feedback.trim()) feedbackError.value = 'Feedback is required.'
  if (
    participantNameError.value ||
    programNameError.value ||
    ratingError.value ||
    feedbackError.value
  )
    return

  try {
    await fetch('https://us-central1-fit5032-assignment-27178.cloudfunctions.net/addFeedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFeedback.value),
    })
    newFeedback.value = { participantName: '', programName: '', rating: '', feedback: '' }
    await fetchFeedbacks()
    await chartRef.value?.loadData()
  } catch (err) {
    console.error('Failed to add feedback:', err)
  }
}

const applyFilters = () => {}
const dt = ref(null)
const exportCSV = () => dt.value.exportCSV()
const exportPDF = () => {
  const doc = new jsPDF()
  doc.text('Feedbacks Report', 14, 10)
  autoTable(doc, {
    head: [['Participant Name', 'Program Name', 'Rating', 'Feedback']],
    body: filteredFeedbacks.value.map((f) => [
      f.participantName,
      f.programName,
      f.rating,
      f.feedback,
    ]),
    startY: 20,
  })
  doc.save('feedbacks.pdf')
}

onMounted(fetchFeedbacks)
</script>

<style scoped>
.program-form {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 30px;
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 8px;
  background-color: #fafafa;
}
.form-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.form-row label {
  width: 150px;
  text-align: right;
  font-weight: 500;
}
.form-row input,
.form-row select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.submit-btn {
  margin-top: 10px;
  padding: 8px 24px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.submit-btn:hover {
  background-color: #0056b3;
}
.error-text {
  color: red;
  font-size: 0.9em;
  margin-left: 160px;
}
:deep(.p-column-filter) {
  width: 120px;
  margin-top: 4px;
  border-radius: 4px;
  border: 2px solid #007bff;
  background-color: #e6f0ff;
  padding: 4px 6px;
  display: block;
}
:deep(.p-column-filter:focus) {
  border-color: #0056b3;
  box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
}
</style>
