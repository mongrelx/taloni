<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in sorted"
          :key="t.id"
          :class="{ done: t.status === 'completed' }"
        >
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
        </tr>
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
</style>
