<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, type Property, type Utility } from '../api'

const properties = ref<Property[]>([])
const utilities = ref<Utility[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[properties.value, utilities.value] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Utility[]>('/api/utilities'),
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

const UTIL_TYPE_LABELS: Record<Utility['type'], string> = {
  electric_siirto: '⚡ Sähkösiirto',
  electric_energia: '⚡ Energia',
  water: '💧 Vesi',
  waste: '🗑 Jäte',
  gas: '🔥 Kaasu',
  internet: '🌐 Netti',
}

const unitFor = (t: Utility['type']) =>
  t.startsWith('electric') ? 'kWh' : t === 'water' ? 'm³' : 'kpl'

const eur = (n: number) => `${n.toFixed(2)} €`

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Ryhmittely laskutuskaudella (uusin ensin) — sama esitys kuin TUI:n renderUtilities()
const months = computed(() =>
  [...new Set(utilities.value.map((u) => u.billing_month))].sort((a, b) =>
    b.localeCompare(a),
  ),
)

function monthUtils(month: string) {
  return utilities.value.filter((u) => u.billing_month === month)
}

function monthTotal(month: string) {
  return monthUtils(month).reduce((s, u) => s + u.amount, 0)
}

function electricTotal(month: string) {
  return monthUtils(month)
    .filter(
      (u) => u.type === 'electric_siirto' || u.type === 'electric_energia',
    )
    .reduce((s, u) => s + u.amount, 0)
}

// --- Lomake ---

const editingId = ref<number | null>(null)
const showForm = ref(false)
const newPropertyId = ref<number | null>(null)

const emptyForm = () => ({
  property_id: newPropertyId.value ?? 0,
  type: 'electric_siirto' as Utility['type'],
  provider: '',
  amount: 0,
  billing_date: new Date().toISOString().slice(0, 10),
  billing_month: currentMonth(),
  usage_value: 0,
})
const form = reactive(emptyForm())

function startAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  showForm.value = true
}

function startEdit(u: Utility) {
  editingId.value = u.id
  Object.assign(form, {
    property_id: u.property_id,
    type: u.type,
    provider: u.provider,
    amount: u.amount,
    billing_date: u.billing_date,
    billing_month: u.billing_month,
    usage_value: u.usage_value,
  })
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function submitForm() {
  submitting.value = true
  try {
    if (editingId.value === null) {
      await api.post('/api/utilities', { ...form })
    } else {
      await api.put(`/api/utilities/${editingId.value}`, { ...form })
    }
    showForm.value = false
    editingId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeUtility(u: Utility) {
  if (
    !confirm(
      `Poistetaanko lasku "${UTIL_TYPE_LABELS[u.type]} — ${u.billing_month}"?`,
    )
  )
    return
  try {
    await api.del(`/api/utilities/${u.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🔌 Sähkö & Kulutus</h2>
      <button class="btn" @click="startAdd">+ Kirjaa lasku</button>
    </div>
    <p class="hint intro">
      Sähkösiirto (verkko) ja energia tulevat usein eri laskuina Suomessa — molemmat kirjataan erikseen.
    </p>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <form v-if="showForm" class="edit-form" @submit.prevent="submitForm">
        <select v-model.number="form.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="form.type">
          <option v-for="(label, key) in UTIL_TYPE_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <input v-model="form.provider" placeholder="Toimittaja" />
        <input v-model.number="form.amount" type="number" placeholder="Summa €" required />
        <input v-model.number="form.usage_value" type="number" :placeholder="`Kulutus (${unitFor(form.type)})`" />
        <input v-model="form.billing_date" type="date" title="Eräpäivä" />
        <input v-model="form.billing_month" type="month" title="Laskutuskausi" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelForm">Peruuta</button>
        </div>
      </form>

      <p v-if="utilities.length === 0" class="hint">
        Ei kulutustietoja. Lisää ensimmäinen lasku yllä olevalla painikkeella.
      </p>
      <div v-else class="months">
        <div v-for="month in months" :key="month" class="month-group">
          <div class="month-header">
            <strong>{{ month }}</strong>
            <span class="dim">Sähkö yht: <span class="amount electric">{{ eur(electricTotal(month)) }}</span></span>
            <span class="dim">Kaikki yht: <span class="amount total">{{ eur(monthTotal(month)) }}</span></span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Kiinteistö</th>
                <th>Laskutyyppi</th>
                <th>Toimittaja</th>
                <th>Summa</th>
                <th>Kulutus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="u in monthUtils(month)" :key="u.id">
                <tr>
                  <td>{{ propName(u.property_id) }}</td>
                  <td>{{ UTIL_TYPE_LABELS[u.type] }}</td>
                  <td>{{ u.provider }}</td>
                  <td class="amount">{{ eur(u.amount) }}</td>
                  <td>{{ u.usage_value > 0 ? `${u.usage_value} ${unitFor(u.type)}` : '—' }}</td>
                  <td class="actions">
                    <button class="icon-btn" title="Muokkaa" @click="startEdit(u)">✏️</button>
                    <button class="icon-btn" title="Poista" @click="removeUtility(u)">🗑️</button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
  color: var(--cyan);
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.intro {
  margin-top: 0;
  margin-bottom: 1rem;
  font-style: italic;
}
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
.edit-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-panel-alt);
  border-radius: 6px;
}
.edit-form input,
.edit-form select {
  flex: 1;
  min-width: 130px;
}
.form-actions {
  display: flex;
  gap: 0.5rem;
}
.months {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.month-group {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.month-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.dim {
  color: var(--text-dim);
  font-size: 0.85rem;
}
.amount {
  font-weight: 600;
}
.amount.electric {
  color: var(--amber);
}
.amount.total {
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
</style>
