<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type AlertRow, api } from '../api'

const rows = ref<AlertRow[]>([])
const loading = ref(true)
const error = ref('')
const days = ref(30)

async function load() {
  loading.value = true
  try {
    rows.value = await api.get<AlertRow[]>(
      `/api/reports/alerts?days=${days.value}`,
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function statusLabel(d: number): string {
  if (d < 0) return `⚠ MYÖHÄSSÄ ${Math.abs(d)} pv`
  if (d === 0) return '⏰ TÄNÄÄN'
  return `${d} pv`
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>⏰ Hälytykset</h2>
      <label class="days-input">
        Aikaikkuna:
        <input v-model.number="days" type="number" min="1" @change="load" />
        pv
      </label>
    </div>
    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="rows.length === 0" class="hint">
      Ei lähestyviä tai myöhässä olevia velvoitteita.
    </p>
    <table v-else>
      <thead>
        <tr>
          <th>Kategoria</th>
          <th>Kuvaus</th>
          <th>Kohde</th>
          <th>Päivä</th>
          <th>Tila</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i" :class="{ overdue: r.daysUntil < 0 }">
          <td>{{ r.category }}</td>
          <td>{{ r.label }}</td>
          <td>{{ r.propertyName }}</td>
          <td>{{ r.date }}</td>
          <td>{{ statusLabel(r.daysUntil) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
  color: var(--purple);
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.days-input {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}
.days-input input {
  width: 60px;
}
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
tr.overdue td {
  color: var(--red);
}
</style>
