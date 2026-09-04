<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, type Property, type Task } from '../api'

const tasks = ref<Task[]>([])
const properties = ref<Property[]>([])
const loading = ref(true)
const error = ref('')

const newTitle = ref('')
const newPropertyId = ref<number | null>(null)
const newPriority = ref<'low' | 'medium' | 'high'>('medium')
const newDueDate = ref(
  new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
)
const submitting = ref(false)

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Ei toistu',
  monthly: 'Kuukausittain',
  quarterly: 'Neljännesvuosittain',
  yearly: 'Vuosittain',
  every_3_years: '3 v välein',
}

const editingId = ref<number | null>(null)
const editForm = reactive({
  title: '',
  property_id: 0,
  priority: 'medium' as 'low' | 'medium' | 'high',
  category: '',
  cost: 0,
  recurrence: 'none',
})

const sorted = computed(() =>
  [...tasks.value].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'completed' ? 1 : -1
    return a.due_date.localeCompare(b.due_date)
  }),
)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[tasks.value, properties.value] = await Promise.all([
      api.get<Task[]>('/api/tasks'),
      api.get<Property[]>('/api/properties'),
    ])
    if (newPropertyId.value === null && properties.value[0]) {
      newPropertyId.value = properties.value[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function addTask() {
  if (!newTitle.value.trim() || newPropertyId.value === null) return
  submitting.value = true
  try {
    await api.post('/api/tasks', {
      property_id: newPropertyId.value,
      title: newTitle.value.trim(),
      status: 'pending',
      priority: newPriority.value,
      due_date: newDueDate.value,
      category: 'Yleinen',
      cost: 0,
      recurrence: 'none',
      next_due: null,
    })
    newTitle.value = ''
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function toggleComplete(t: Task) {
  const next = t.status === 'completed' ? 'pending' : 'completed'
  await api.patch(`/api/tasks/${t.id}/status`, { status: next })
  await load()
}

function startEdit(t: Task) {
  editingId.value = t.id
  Object.assign(editForm, {
    title: t.title,
    property_id: t.property_id,
    priority: t.priority,
    category: t.category,
    cost: t.cost,
    recurrence: t.recurrence,
  })
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(t: Task) {
  if (!editForm.title.trim()) return
  submitting.value = true
  try {
    // due_date ja status eivät ole tässä muokattavissa (samoin kuin TUI:ssa) —
    // updateTask() ei kirjoita niitä, joten kannetaan olemassa olevat arvot muuttumattomina.
    await api.put(`/api/tasks/${t.id}`, {
      property_id: editForm.property_id,
      title: editForm.title.trim(),
      status: t.status,
      priority: editForm.priority,
      due_date: t.due_date,
      category: editForm.category || 'Yleinen',
      cost: editForm.cost,
      recurrence: editForm.recurrence,
      next_due: t.next_due,
    })
    editingId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeTask(t: Task) {
  if (!confirm(`Poistetaanko tehtävä "${t.title}"?`)) return
  try {
    await api.del(`/api/tasks/${t.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}
</script>

<template>
  <div class="panel">
    <h2>📋 Tehtävät</h2>

    <form class="add-form" @submit.prevent="addTask">
      <input v-model="newTitle" placeholder="Uusi tehtävä…" />
      <select v-model.number="newPropertyId">
        <option v-for="p in properties" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
      <select v-model="newPriority">
        <option value="low">Matala</option>
        <option value="medium">Keskitaso</option>
        <option value="high">Korkea</option>
      </select>
      <input v-model="newDueDate" type="date" />
      <button class="btn" type="submit" :disabled="submitting">Lisää</button>
    </form>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr>
          <th></th>
          <th>Otsikko</th>
          <th>Kohde</th>
          <th>Kiireellisyys</th>
          <th>Eräpäivä</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="t in sorted" :key="t.id">
          <tr :class="{ done: t.status === 'completed' }">
            <td>
              <input
                type="checkbox"
                :checked="t.status === 'completed'"
                @change="toggleComplete(t)"
              />
            </td>
            <td>{{ t.title }}</td>
            <td>{{ propName(t.property_id) }}</td>
            <td>
              <span :class="['priority', t.priority]">{{ t.priority }}</span>
            </td>
            <td>{{ t.due_date }}</td>
            <td class="actions">
              <button class="icon-btn" title="Muokkaa" @click="startEdit(t)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeTask(t)">🗑️</button>
            </td>
          </tr>
          <tr v-if="editingId === t.id" class="edit-row">
            <td colspan="6">
              <form class="edit-form" @submit.prevent="saveEdit(t)">
                <input v-model="editForm.title" placeholder="Otsikko" required />
                <select v-model.number="editForm.property_id">
                  <option v-for="p in properties" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <select v-model="editForm.priority">
                  <option value="low">Matala</option>
                  <option value="medium">Keskitaso</option>
                  <option value="high">Korkea</option>
                </select>
                <input v-model="editForm.category" placeholder="Kategoria" />
                <input v-model.number="editForm.cost" type="number" placeholder="Kustannus €" />
                <select v-model="editForm.recurrence">
                  <option
                    v-for="(label, key) in RECURRENCE_LABELS"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </option>
                </select>
                <div class="form-actions">
                  <button class="btn" type="submit" :disabled="submitting">Tallenna</button>
                  <button class="btn-secondary" type="button" @click="cancelEdit">
                    Peruuta
                  </button>
                </div>
              </form>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
h2 {
  margin-top: 0;
  color: var(--purple);
}
.add-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.add-form input[type='text'],
.add-form input:not([type]) {
  flex: 1;
  min-width: 160px;
}
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
tr.done {
  opacity: 0.5;
  text-decoration: line-through;
}
.priority {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}
.priority.high {
  background: rgba(231, 76, 60, 0.2);
  color: var(--red);
}
.priority.medium {
  background: rgba(243, 156, 18, 0.2);
  color: var(--amber);
}
.priority.low {
  background: rgba(46, 204, 113, 0.2);
  color: var(--green);
}
.actions {
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
}
.icon-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  padding: 0.1rem 0.3rem;
}
.icon-btn:hover {
  opacity: 0.7;
}
.edit-row td {
  background: var(--bg-panel-alt);
  padding: 0.75rem 0.5rem;
}
.edit-row .edit-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
}
.edit-row .edit-form input,
.edit-row .edit-form select {
  flex: 1;
  min-width: 120px;
}
.form-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
