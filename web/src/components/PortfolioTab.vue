<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type PortfolioReport } from '../api'

const report = ref<PortfolioReport | null>(null)
const loading = ref(true)
const error = ref('')
const year = ref(new Date().getFullYear())

const eur = (n: number) => `${n.toFixed(2)} €`

async function load() {
  loading.value = true
  try {
    report.value = await api.get<PortfolioReport>(
      `/api/reports/portfolio?year=${year.value}`,
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>📊 Salkkuvertailu</h2>
      <label class="year-input">
        Vuosi:
        <input v-model.number="year" type="number" @change="load" />
      </label>
    </div>
    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else-if="report">
      <div class="cards">
        <div v-for="row in report.rows" :key="row.propertyId" class="card">
          <h3>{{ row.name }}</h3>
          <p class="kv">
            <span>Tulot</span><span class="pos">{{ eur(row.income) }}</span>
          </p>
          <p class="kv">
            <span>Menot</span><span class="neg">{{ eur(row.expense) }}</span>
          </p>
          <p class="kv">
            <span>Netto</span>
            <span :class="row.net >= 0 ? 'pos' : 'neg'">{{ eur(row.net) }}</span>
          </p>
          <p class="kv">
            <span>ROI</span>
            <span>{{ row.roi === null ? '—' : `${row.roi.toFixed(1)} %` }}</span>
          </p>
          <p class="kv">
            <span>Tehtäviä avoinna</span>
            <span>{{ row.openTasks }} ({{ row.overdueTasks }} myöhässä)</span>
          </p>
          <p class="kv">
            <span>Käyttöaste</span>
            <span>{{ row.occupancyRate.toFixed(1) }} % ({{ row.nights }} yötä)</span>
          </p>
          <p v-if="row.latestValue !== null" class="kv">
            <span>Arvioitu arvo</span><span>{{ eur(row.latestValue) }}</span>
          </p>
        </div>
      </div>
      <p class="totals">
        Yhteensä: tulot {{ eur(report.totals.income) }} · menot
        {{ eur(report.totals.expense) }} · netto {{ eur(report.totals.net) }} ·
        käyttöaste {{ report.totals.occupancyRate.toFixed(1) }} %
      </p>
    </template>
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
.year-input {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}
.year-input input {
  width: 90px;
}
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.card {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.card h3 {
  margin: 0 0 0.5rem;
  color: var(--cyan);
  font-size: 1rem;
}
.kv {
  display: flex;
  justify-content: space-between;
  margin: 0.25rem 0;
  font-size: 0.85rem;
}
.kv span:first-child {
  color: var(--text-dim);
}
.pos {
  color: var(--green);
}
.neg {
  color: var(--red);
}
.totals {
  margin-top: 1rem;
  color: var(--text-dim);
  font-size: 0.85rem;
}
</style>
