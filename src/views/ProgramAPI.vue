<template>
  <div style="width: 900px; margin: 50px auto">
    <h2 style="margin-bottom: 20px; text-align: center">Programs</h2>

    <!-- 新增 Program 表单 -->
    <form @submit.prevent="submitProgram" class="program-form">
      <div class="form-row">
        <label>Program Name:</label>
        <input type="text" v-model="newProgram.name" />
      </div>
      <p v-if="nameError" class="error-text">{{ nameError }}</p>

      <div class="form-row">
        <label>Category:</label>
        <input type="text" v-model="newProgram.category" />
      </div>
      <p v-if="categoryError" class="error-text">{{ categoryError }}</p>

      <div class="form-row">
        <label>Location:</label>
        <input type="text" v-model="newProgram.location" />
      </div>
      <p v-if="locationError" class="error-text">{{ locationError }}</p>

      <div class="form-row">
        <label>Target Age:</label>
        <input type="text" v-model="newProgram.targetAge" />
      </div>
      <p v-if="targetAgeError" class="error-text">{{ targetAgeError }}</p>

      <div style="text-align: center">
        <button type="submit" class="submit-btn">Add Program</button>
      </div>
    </form>

    <!-- Programs DataTable -->
    <DataTable
      :value="filteredPrograms"
      paginator
      :rows="10"
      responsiveLayout="scroll"
      sortMode="single"
      class="p-datatable-gridlines"
      ref="dt"
    >
      <template #header>
        <div class="text-end pb-4">
          <Button icon="pi pi-external-link" label="Export CSV" @click="exportCSV" class="mr-2" />
          <Button icon="pi pi-file-pdf" label="Export PDF" @click="exportPDF" />
        </div>
      </template>

      <Column field="name" header="Program Name" sortable>
        <template #header>
          <InputText
            v-model="filters.name"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column field="category" header="Category" sortable>
        <template #header>
          <InputText
            v-model="filters.category"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column field="location" header="Location" sortable>
        <template #header>
          <InputText
            v-model="filters.location"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column field="targetAge" header="Target Age" sortable>
        <template #header>
          <InputText
            v-model="filters.targetAge"
            @input="applyFilters"
            placeholder="Search"
            class="p-column-filter"
          />
        </template>
      </Column>
    </DataTable>
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

// ---------------- State ----------------
const programs = ref([])
const newProgram = ref({ name: '', category: '', location: '', targetAge: '' })

const nameError = ref('')
const categoryError = ref('')
const locationError = ref('')
const targetAgeError = ref('')

// 搜索
const filters = reactive({ name: '', category: '', location: '', targetAge: '' })
const filteredPrograms = computed(() => {
  return programs.value.filter((p) => {
    return (
      (!filters.name || p.name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (!filters.category || p.category.toLowerCase().includes(filters.category.toLowerCase())) &&
      (!filters.location || p.location.toLowerCase().includes(filters.location.toLowerCase())) &&
      (!filters.targetAge || p.targetAge.toLowerCase().includes(filters.targetAge.toLowerCase()))
    )
  })
})

// ---------------- Functions ----------------
const fetchPrograms = async () => {
  try {
    const res = await fetch(
      'https://us-central1-fit5032-assignment-27178.cloudfunctions.net/getPrograms',
    )
    const data = await res.json()
    programs.value = data
  } catch (err) {
    console.error('Failed to fetch programs:', err)
  }
}

const submitProgram = async () => {
  nameError.value = ''
  categoryError.value = ''
  locationError.value = ''
  targetAgeError.value = ''

  if (!newProgram.value.name.trim()) nameError.value = 'Program Name is required.'
  if (!newProgram.value.category.trim()) categoryError.value = 'Category is required.'
  if (!newProgram.value.location.trim()) locationError.value = 'Location is required.'
  if (!newProgram.value.targetAge.trim()) targetAgeError.value = 'Target Age is required.'

  if (nameError.value || categoryError.value || locationError.value || targetAgeError.value) return

  try {
    await fetch('https://us-central1-fit5032-assignment-27178.cloudfunctions.net/addProgram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProgram.value),
    })
    newProgram.value = { name: '', category: '', location: '', targetAge: '' }
    await fetchPrograms()
  } catch (err) {
    console.error('Failed to add program:', err)
  }
}

const applyFilters = () => {}

// ---------------- Export Functions ----------------
const dt = ref(null)

const exportCSV = () => {
  dt.value.exportCSV()
}

const exportPDF = () => {
  const doc = new jsPDF()
  doc.text('Programs Report', 14, 10)
  autoTable(doc, {
    head: [['Program Name', 'Category', 'Location', 'Target Age']],
    body: filteredPrograms.value.map((p) => [p.name, p.category, p.location, p.targetAge]),
    startY: 20,
  })

  doc.save('programs.pdf')
}

onMounted(fetchPrograms)
</script>

<style scoped>
/* 保持原样式 */
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
  width: 130px;
  text-align: right;
  font-weight: 500;
}
.form-row input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.submit-btn {
  margin-top: 10px;
  padding: 8px 24px;
  background-color: #007bff;
  color: white;
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
  margin-left: 140px;
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
</style>
