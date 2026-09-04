<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  api,
  type Property,
  type Renovation,
  type RenovationBudgetRow,
  type Transaction,
} from '../api'

const section = ref<'renovations' | 'transactions'>('renovations')

const properties = ref<Property[]>([])
const renovations = ref<Renovation[]>([])
const budgetRows = ref<RenovationBudgetRow[]>([])
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[
      properties.value,
      renovations.value,
      budgetRows.value,
      transactions.value,
    ] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Renovation[]>('/api/renovations'),
      api.get<RenovationBudgetRow[]>('/api/reports/renovations'),
      api.get<Transaction[]>('/api/transactions'),
    ])
    if (newTxPropertyId.value === null && properties.value[0]) {
      newTxPropertyId.value = properties.value[0].id
    }
    if (newRenPropertyId.value === null && properties.value[0]) {
      newRenPropertyId.value = properties.value[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const budgetFor = (renovationId: number) =>
  budgetRows.value.find((r) => r.renovationId === renovationId)

const eur = (n: number) => `${n.toFixed(2)} €`

const RENOVATION_STATUS_LABELS: Record<string, string> = {
  planning: 'Suunnitteilla',
  in_progress: 'Käynnissä',
  completed: 'Valmis',
}

// --- Remontit ---

const editingRenId = ref<number | null>(null)
const showRenForm = ref(false)
const newRenPropertyId = ref<number | null>(null)

const emptyRenForm = () => ({
  property_id: newRenPropertyId.value ?? 0,
  project_name: '',
  status: 'planning' as Renovation['status'],
  budget: 0,
  spent: 0,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '' as string,
})
const renForm = reactive(emptyRenForm())

function startAddRen() {
  editingRenId.value = null
  Object.assign(renForm, emptyRenForm())
  showRenForm.value = true
}

function startEditRen(r: Renovation) {
  editingRenId.value = r.id
  Object.assign(renForm, {
    property_id: r.property_id,
    project_name: r.project_name,
    status: r.status,
    budget: r.budget,
    spent: r.spent,
    start_date: r.start_date,
    end_date: r.end_date ?? '',
  })
  showRenForm.value = true
}

function cancelRenForm() {
  showRenForm.value = false
  editingRenId.value = null
}

async function submitRenForm() {
  if (!renForm.project_name.trim()) return
  submitting.value = true
  try {
    const payload = {
      ...renForm,
      project_name: renForm.project_name.trim(),
      end_date: renForm.end_date || null,
    }
    if (editingRenId.value === null) {
      await api.post('/api/renovations', payload)
    } else {
      await api.put(`/api/renovations/${editingRenId.value}`, payload)
    }
    showRenForm.value = false
    editingRenId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeRenovation(r: Renovation) {
  if (!confirm(`Poistetaanko remonttiprojekti "${r.project_name}"?`)) return
  try {
    await api.del(`/api/renovations/${r.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Taloustapahtumat ---

const editingTxId = ref<number | null>(null)
const newTxPropertyId = ref<number | null>(null)
const newTxType = ref<'income' | 'expense'>('expense')
const newTxCategory = ref('')
const newTxAmount = ref(0)
const newTxDate = ref(new Date().toISOString().slice(0, 10))
const newTxDescription = ref('')
const newTxRenovationId = ref<number | null>(null)

const editTxForm = reactive({
  property_id: 0,
  type: 'expense' as 'income' | 'expense',
  category: '',
  amount: 0,
  description: '',
  renovation_id: null as number | null,
})

const sortedTransactions = computed(() =>
  [...transactions.value].sort((a, b) => b.date.localeCompare(a.date)),
)

async function addTransaction() {
  if (newTxPropertyId.value === null || !newTxCategory.value.trim()) return
  submitting.value = true
  try {
    await api.post('/api/transactions', {
      property_id: newTxPropertyId.value,
      type: newTxType.value,
      category: newTxCategory.value.trim(),
      amount: newTxAmount.value,
      date: newTxDate.value,
      description: newTxDescription.value.trim(),
      renovation_id: newTxRenovationId.value,
    })
    newTxCategory.value = ''
    newTxAmount.value = 0
    newTxDescription.value = ''
    newTxRenovationId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

function startEditTx(t: Transaction) {
  editingTxId.value = t.id
  Object.assign(editTxForm, {
    property_id: t.property_id,
    type: t.type,
    category: t.category,
    amount: t.amount,
    description: t.description,
    renovation_id: t.renovation_id,
  })
}

function cancelEditTx() {
  editingTxId.value = null
}

async function saveEditTx(t: Transaction) {
  if (!editTxForm.category.trim()) return
  submitting.value = true
  try {
    // date ei ole tässä muokattavissa — updateTransaction() ei kirjoita sitä
    // (sama rajoitus kuin TUI:ssa), joten kannetaan alkuperäinen arvo läpi.
    await api.put(`/api/transactions/${t.id}`, {
      property_id: editTxForm.property_id,
      type: editTxForm.type,
      category: editTxForm.category.trim(),
      amount: editTxForm.amount,
      date: t.date,
      description: editTxForm.description.trim(),
      renovation_id: editTxForm.renovation_id,
    })
    editingTxId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeTransaction(t: Transaction) {
  if (!confirm(`Poistetaanko tapahtuma "${t.description || t.category}"?`))
    return
  try {
    await api.del(`/api/transactions/${t.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

function renovationName(id: number | null): string {
  if (id === null) return '—'
  return renovations.value.find((r) => r.id === id)?.project_name ?? `#${id}`
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>💰 Talous &amp; Korjaukset</h2>
      <div class="section-toggle">
        <button
          :class="['tab-small', { active: section === 'renovations' }]"
          @click="section = 'renovations'"
        >
          Remontit
        </button>
        <button
          :class="['tab-small', { active: section === 'transactions' }]"
          @click="section = 'transactions'"
        >
          Taloustapahtumat
        </button>
      </div>
    </div>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="section === 'renovations'">
      <div class="actions-row">
        <button class="btn" @click="startAddRen">+ Lisää remontti</button>
      </div>
      <form v-if="showRenForm" class="edit-form" @submit.prevent="submitRenForm">
        <select v-model.number="renForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <input v-model="renForm.project_name" placeholder="Projektin nimi" required />
        <select v-model="renForm.status">
          <option v-for="(label, key) in RENOVATION_STATUS_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <input v-model.number="renForm.budget" type="number" placeholder="Budjetti €" />
        <input v-model.number="renForm.spent" type="number" placeholder="Toteutunut €" />
        <input v-model="renForm.start_date" type="date" />
        <input v-model="renForm.end_date" type="date" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingRenId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelRenForm">Peruuta</button>
        </div>
      </form>

      <p v-if="renovations.length === 0" class="hint">Ei remonttiprojekteja.</p>
      <div v-else class="renovations">
        <div v-for="r in renovations" :key="r.id" class="renovation-card">
          <div class="renovation-header">
            <div>
              <strong>{{ r.project_name }}</strong>
              <span class="dim"> — {{ propName(r.property_id) }}</span>
              <span :class="['status', r.status]">{{ RENOVATION_STATUS_LABELS[r.status] }}</span>
              <span v-if="budgetFor(r.id)?.overBudget" class="overbudget">⚠ YLITYS</span>
            </div>
            <div class="actions">
              <button class="icon-btn" title="Muokkaa" @click="startEditRen(r)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeRenovation(r)">🗑️</button>
            </div>
          </div>
          <div class="progress-bar">
            <div
              :class="['progress-fill', { over: r.spent > r.budget }]"
              :style="{ width: `${Math.min(100, r.budget > 0 ? (r.spent / r.budget) * 100 : 0)}%` }"
            ></div>
          </div>
          <p class="kv">
            <span>Budjetti {{ eur(r.budget) }} · Toteutunut {{ eur(r.spent) }} · Erotus
              {{ eur(r.budget - r.spent) }}</span>
          </p>
          <p v-if="budgetFor(r.id) && budgetFor(r.id)!.linkedExpenses > 0" class="kv dim">
            Linkitetyt taloustapahtumat: {{ eur(budgetFor(r.id)!.linkedExpenses) }}
          </p>
        </div>
      </div>
    </template>

    <template v-else>
      <form class="add-form" @submit.prevent="addTransaction">
        <select v-model.number="newTxPropertyId">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="newTxType">
          <option value="income">Tulo</option>
          <option value="expense">Meno</option>
        </select>
        <input v-model="newTxCategory" placeholder="Kategoria" required />
        <input v-model.number="newTxAmount" type="number" placeholder="Summa €" />
        <input v-model="newTxDate" type="date" />
        <input v-model="newTxDescription" placeholder="Kuvaus" />
        <select v-model="newTxRenovationId">
          <option :value="null">Ei remonttia</option>
          <option v-for="r in renovations" :key="r.id" :value="r.id">{{ r.project_name }}</option>
        </select>
        <button class="btn" type="submit" :disabled="submitting">Lisää</button>
      </form>

      <p v-if="sortedTransactions.length === 0" class="hint">Ei tapahtumia.</p>
      <table v-else>
        <thead>
          <tr>
            <th>Pvm</th>
            <th>Tyyppi</th>
            <th>Kategoria</th>
            <th>Summa</th>
            <th>Kohde</th>
            <th>Remontti</th>
            <th>Kuvaus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in sortedTransactions" :key="t.id">
            <tr>
              <td>{{ t.date }}</td>
              <td>
                <span :class="['type-badge', t.type]">{{ t.type === 'income' ? 'Tulo' : 'Meno' }}</span>
              </td>
              <td>{{ t.category }}</td>
              <td :class="t.type === 'income' ? 'pos' : 'neg'">{{ eur(t.amount) }}</td>
              <td>{{ propName(t.property_id) }}</td>
              <td>{{ renovationName(t.renovation_id) }}</td>
              <td>{{ t.description }}</td>
              <td class="actions">
                <button class="icon-btn" title="Muokkaa" @click="startEditTx(t)">✏️</button>
                <button class="icon-btn" title="Poista" @click="removeTransaction(t)">🗑️</button>
              </td>
            </tr>
            <tr v-if="editingTxId === t.id" class="edit-row">
              <td colspan="8">
                <form class="edit-form" @submit.prevent="saveEditTx(t)">
                  <select v-model.number="editTxForm.property_id">
                    <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                  <select v-model="editTxForm.type">
                    <option value="income">Tulo</option>
                    <option value="expense">Meno</option>
                  </select>
                  <input v-model="editTxForm.category" placeholder="Kategoria" required />
                  <input v-model.number="editTxForm.amount" type="number" placeholder="Summa €" />
                  <input v-model="editTxForm.description" placeholder="Kuvaus" />
                  <select v-model="editTxForm.renovation_id">
                    <option :value="null">Ei remonttia</option>
                    <option v-for="r in renovations" :key="r.id" :value="r.id">
                      {{ r.project_name }}
                    </option>
                  </select>
                  <div class="form-actions">
                    <button class="btn" type="submit" :disabled="submitting">Tallenna</button>
                    <button class="btn-secondary" type="button" @click="cancelEditTx">
                      Peruuta
                    </button>
                  </div>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.section-toggle {
  display: flex;
  gap: 0.4rem;
}
.tab-small {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
}
.tab-small.active {
  border-color: var(--cyan);
  color: var(--cyan);
}
.actions-row {
  margin-bottom: 1rem;
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
.add-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.add-form input,
.add-form select {
  flex: 1;
  min-width: 120px;
}
.renovations {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.renovation-card {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.renovation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.dim {
  color: var(--text-dim);
}
.status {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  text-transform: uppercase;
  background: rgba(0, 212, 255, 0.15);
  color: var(--cyan);
}
.overbudget {
  margin-left: 0.5rem;
  color: var(--red);
  font-size: 0.8rem;
}
.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--bg);
  overflow: hidden;
  margin-bottom: 0.5rem;
}
.progress-fill {
  height: 100%;
  background: var(--green);
}
.progress-fill.over {
  background: var(--red);
}
.kv {
  margin: 0.2rem 0;
  font-size: 0.85rem;
}
.kv.dim {
  color: var(--text-dim);
}
.type-badge {
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}
.type-badge.income {
  background: rgba(46, 204, 113, 0.2);
  color: var(--green);
}
.type-badge.expense {
  background: rgba(231, 76, 60, 0.2);
  color: var(--red);
}
.pos {
  color: var(--green);
}
.neg {
  color: var(--red);
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
</style>
