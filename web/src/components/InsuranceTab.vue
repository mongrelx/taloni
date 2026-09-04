<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, type Insurance, type Property, type Tool } from '../api'

const section = ref<'tools' | 'insurance'>('tools')

const properties = ref<Property[]>([])
const tools = ref<Tool[]>([])
const insurance = ref<Insurance[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[properties.value, tools.value, insurance.value] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Tool[]>('/api/tools'),
      api.get<Insurance[]>('/api/insurance'),
    ])
    if (newInsPropertyId.value === null && properties.value[0]) {
      newInsPropertyId.value = properties.value[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const TOOL_STATUS_LABELS: Record<Tool['status'], string> = {
  working: 'Käyttökunnossa',
  needs_repair: 'Huollossa',
  lost: 'Kadonnut',
}

const eur = (n: number) => `${n.toFixed(2)} €`

// --- Kalusto ---

const editingToolId = ref<number | null>(null)
const showToolForm = ref(false)

const emptyToolForm = () => ({
  name: '',
  status: 'working' as Tool['status'],
  location: '',
  purchase_date: new Date().toISOString().slice(0, 10),
})
const toolForm = reactive(emptyToolForm())

function startAddTool() {
  editingToolId.value = null
  Object.assign(toolForm, emptyToolForm())
  showToolForm.value = true
}

function startEditTool(t: Tool) {
  editingToolId.value = t.id
  Object.assign(toolForm, {
    name: t.name,
    status: t.status,
    location: t.location,
    purchase_date: t.purchase_date,
  })
  showToolForm.value = true
}

function cancelToolForm() {
  showToolForm.value = false
  editingToolId.value = null
}

async function submitToolForm() {
  if (!toolForm.name.trim()) return
  submitting.value = true
  try {
    const payload = { ...toolForm, name: toolForm.name.trim() }
    if (editingToolId.value === null) {
      await api.post('/api/tools', payload)
    } else {
      await api.put(`/api/tools/${editingToolId.value}`, payload)
    }
    showToolForm.value = false
    editingToolId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeTool(t: Tool) {
  if (!confirm(`Poistetaanko työkalu "${t.name}"?`)) return
  try {
    await api.del(`/api/tools/${t.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Vakuutukset ---

const editingInsId = ref<number | null>(null)
const showInsForm = ref(false)
const newInsPropertyId = ref<number | null>(null)

const emptyInsForm = () => ({
  property_id: newInsPropertyId.value ?? 0,
  policy_name: '',
  provider: '',
  premium: 0,
  renewal_date: new Date().toISOString().slice(0, 10),
  coverage_details: '',
})
const insForm = reactive(emptyInsForm())

function startAddIns() {
  editingInsId.value = null
  Object.assign(insForm, emptyInsForm())
  showInsForm.value = true
}

function startEditIns(i: Insurance) {
  editingInsId.value = i.id
  Object.assign(insForm, {
    property_id: i.property_id,
    policy_name: i.policy_name,
    provider: i.provider,
    premium: i.premium,
    renewal_date: i.renewal_date,
    coverage_details: i.coverage_details,
  })
  showInsForm.value = true
}

function cancelInsForm() {
  showInsForm.value = false
  editingInsId.value = null
}

async function submitInsForm() {
  if (!insForm.policy_name.trim()) return
  submitting.value = true
  try {
    const payload = { ...insForm, policy_name: insForm.policy_name.trim() }
    if (editingInsId.value === null) {
      await api.post('/api/insurance', payload)
    } else {
      await api.put(`/api/insurance/${editingInsId.value}`, payload)
    }
    showInsForm.value = false
    editingInsId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeInsurance(i: Insurance) {
  if (!confirm(`Poistetaanko vakuutus "${i.policy_name}"?`)) return
  try {
    await api.del(`/api/insurance/${i.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🛡 Vakuutus &amp; Kalusto</h2>
      <div class="section-toggle">
        <button
          :class="['tab-small', { active: section === 'tools' }]"
          @click="section = 'tools'"
        >
          Kalusto
        </button>
        <button
          :class="['tab-small', { active: section === 'insurance' }]"
          @click="section = 'insurance'"
        >
          Vakuutukset
        </button>
      </div>
    </div>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="section === 'tools'">
      <div class="actions-row">
        <button class="btn" @click="startAddTool">+ Lisää työkalu</button>
      </div>
      <form v-if="showToolForm" class="edit-form" @submit.prevent="submitToolForm">
        <input v-model="toolForm.name" placeholder="Laite / työkalu" required />
        <select v-model="toolForm.status">
          <option v-for="(label, key) in TOOL_STATUS_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <input v-model="toolForm.location" placeholder="Sijaintipaikka" />
        <input v-model="toolForm.purchase_date" type="date" title="Hankintapäivä" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingToolId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelToolForm">Peruuta</button>
        </div>
      </form>

      <p v-if="tools.length === 0" class="hint">Ei kalustoa.</p>
      <table v-else>
        <thead>
          <tr>
            <th>Laite / Työkalu</th>
            <th>Kuntotila</th>
            <th>Sijaintipaikka</th>
            <th>Hankittu</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tools" :key="t.id">
            <td>{{ t.name }}</td>
            <td>
              <span :class="['status-badge', t.status]">{{ TOOL_STATUS_LABELS[t.status] }}</span>
            </td>
            <td>{{ t.location }}</td>
            <td>{{ t.purchase_date }}</td>
            <td class="actions">
              <button class="icon-btn" title="Muokkaa" @click="startEditTool(t)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeTool(t)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <div class="actions-row">
        <button class="btn" @click="startAddIns">+ Lisää vakuutus</button>
      </div>
      <form v-if="showInsForm" class="edit-form" @submit.prevent="submitInsForm">
        <select v-model.number="insForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <input v-model="insForm.policy_name" placeholder="Vakuutuksen nimi" required />
        <input v-model="insForm.provider" placeholder="Yhtiö" />
        <input v-model.number="insForm.premium" type="number" placeholder="Vuosimaksu €" />
        <input v-model="insForm.renewal_date" type="date" title="Uusitaan" />
        <input v-model="insForm.coverage_details" placeholder="Kattavuus" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingInsId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelInsForm">Peruuta</button>
        </div>
      </form>

      <p v-if="insurance.length === 0" class="hint">Ei vakuutuksia.</p>
      <div v-else class="policies">
        <div v-for="i in insurance" :key="i.id" class="policy-card">
          <div class="policy-header">
            <div>
              <strong>{{ i.policy_name }}</strong>
              <span class="dim"> — {{ propName(i.property_id) }}</span>
            </div>
            <div class="actions">
              <span class="premium">{{ eur(i.premium) }} / v</span>
              <button class="icon-btn" title="Muokkaa" @click="startEditIns(i)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeInsurance(i)">🗑️</button>
            </div>
          </div>
          <p class="kv">Yhtiö: {{ i.provider }} · Uusitaan: {{ i.renewal_date }}</p>
          <p class="kv dim">Kattavuus: {{ i.coverage_details }}</p>
        </div>
      </div>
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
.status-badge {
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}
.status-badge.working {
  background: rgba(46, 204, 113, 0.2);
  color: var(--green);
}
.status-badge.needs_repair {
  background: rgba(231, 76, 60, 0.2);
  color: var(--red);
}
.status-badge.lost {
  background: rgba(149, 165, 166, 0.2);
  color: var(--text-dim);
}
.policies {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.policy-card {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.policy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}
.dim {
  color: var(--text-dim);
}
.premium {
  color: var(--green);
  font-weight: 600;
  font-size: 0.85rem;
}
.kv {
  margin: 0.2rem 0;
  font-size: 0.85rem;
}
.kv.dim {
  color: var(--text-dim);
}
.actions {
  display: flex;
  gap: 0.4rem;
  align-items: center;
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
