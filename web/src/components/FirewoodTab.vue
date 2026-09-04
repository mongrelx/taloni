<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, type CompostingRow, type Firewood, type Property } from '../api'

const properties = ref<Property[]>([])
const firewood = ref<Firewood[]>([])
const composting = ref<CompostingRow[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[properties.value, firewood.value, composting.value] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Firewood[]>('/api/firewood'),
      api.get<CompostingRow[]>('/api/reports/composting'),
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

const today = new Date().toISOString().slice(0, 10)

// --- Polttopuu ---

const WOOD_TYPES = ['Koivu', 'Kuusi', 'Mänty', 'Leppä', 'Haapa', 'Sekapuu']
const FIREWOOD_UNITS: Firewood['unit'][] = ['pino-m³', 'motti', 'irto-m³']
const DRYING_STATES: Firewood['drying_status'][] = ['fresh', 'drying', 'ready']
const DRYING_LABELS: Record<Firewood['drying_status'], string> = {
  fresh: 'Tuore',
  drying: 'Kuivumassa',
  ready: 'Käyttövalmis',
}

const editingId = ref<number | null>(null)
const showForm = ref(false)
const newPropertyId = ref<number | null>(null)

const emptyForm = () => ({
  property_id: newPropertyId.value ?? 0,
  wood_type: WOOD_TYPES[0] as string,
  volume: 0,
  unit: 'pino-m³' as Firewood['unit'],
  location: '',
  drying_status: 'fresh' as Firewood['drying_status'],
  stacked_date: today,
  notes: '',
})
const form = reactive(emptyForm())

function startAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  showForm.value = true
}

function startEdit(f: Firewood) {
  editingId.value = f.id
  Object.assign(form, {
    property_id: f.property_id,
    wood_type: f.wood_type,
    volume: f.volume,
    unit: f.unit,
    location: f.location,
    drying_status: f.drying_status,
    stacked_date: f.stacked_date,
    notes: f.notes,
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
      await api.post('/api/firewood', { ...form })
    } else {
      await api.put(`/api/firewood/${editingId.value}`, { ...form })
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

async function removeFirewood(f: Firewood) {
  if (
    !confirm(
      `Poistetaanko polttopuuerä (${f.wood_type}, ${f.volume} ${f.unit})?`,
    )
  )
    return
  try {
    await api.del(`/api/firewood/${f.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// Kokonaispinokuutiot: motti ≈ pino-m³; irto-m³ kerrotaan 0.62 pinokuutioksi (karkea muunnos,
// sama kuin TUI:ssa).
function toPinoM3(f: Firewood): number {
  return f.unit === 'irto-m³' ? f.volume * 0.62 : f.volume
}
const readyTotal = computed(() =>
  firewood.value
    .filter((f) => f.drying_status === 'ready')
    .reduce((s, f) => s + toPinoM3(f), 0),
)
const grandTotal = computed(() =>
  firewood.value.reduce((s, f) => s + toPinoM3(f), 0),
)

// --- Sauna & kiinteät vuosikulut (muokataan Kiinteistöt-välilehdellä) ---

const SAUNA_LABELS: Record<Property['sauna_type'], string> = {
  none: 'Ei saunaa',
  wood: '🔥 Puukiuas',
  electric: '⚡ Sähkökiuas',
}
const BIOWASTE_LABELS: Record<Property['biowaste'], string> = {
  collection: 'Kunnan keräys',
  home_compost: 'Kotikompostointi',
  shared: 'Yhteiskeräyspiste',
  none: 'Ei biojätettä',
}

function compostFor(propertyId: number) {
  return (
    composting.value.find((c) => c.property_id === propertyId)?.assessment ??
    null
  )
}

const fixedCostsTotal = computed(() =>
  properties.value.reduce(
    (s, p) => s + (p.property_tax ?? 0) + (p.road_fee ?? 0),
    0,
  ),
)
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🪵 Polttopuu & Sauna</h2>
    </div>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <div class="split">
        <div class="col">
          <div class="actions-row">
            <button class="btn" @click="startAdd">+ Lisää polttopuuerä</button>
          </div>
          <div class="totals-row">
            <span class="dim">Käyttövalmista: </span>
            <strong class="ready">{{ readyTotal.toFixed(1) }} pino-m³</strong>
            <span class="dim"> | Yhteensä: </span>
            <strong class="total">{{ grandTotal.toFixed(1) }} pino-m³</strong>
          </div>

          <form v-if="showForm" class="edit-form" @submit.prevent="submitForm">
            <select v-model.number="form.property_id">
              <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <select v-model="form.wood_type">
              <option v-for="w in WOOD_TYPES" :key="w" :value="w">{{ w }}</option>
            </select>
            <input v-model.number="form.volume" type="number" step="0.1" placeholder="Määrä" />
            <select v-model="form.unit">
              <option v-for="u in FIREWOOD_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
            <select v-model="form.drying_status">
              <option v-for="d in DRYING_STATES" :key="d" :value="d">
                {{ DRYING_LABELS[d] }}
              </option>
            </select>
            <input v-model="form.location" placeholder="Varastopaikka (esim. klapiliiteri)" />
            <input v-model="form.stacked_date" type="date" title="Pinottu" />
            <input v-model="form.notes" placeholder="Huomiot" />
            <div class="form-actions">
              <button class="btn" type="submit" :disabled="submitting">
                {{ editingId === null ? 'Lisää' : 'Tallenna' }}
              </button>
              <button class="btn-secondary" type="button" @click="cancelForm">Peruuta</button>
            </div>
          </form>

          <p v-if="firewood.length === 0" class="hint">
            Ei polttopuueriä.
          </p>
          <table v-else>
            <thead>
              <tr>
                <th>Kohde</th>
                <th>Puulaji</th>
                <th>Määrä</th>
                <th>Tila</th>
                <th>Paikka</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in firewood" :key="f.id">
                <td>{{ propName(f.property_id) }}</td>
                <td>{{ f.wood_type }}</td>
                <td>{{ f.volume }} {{ f.unit }}</td>
                <td :class="['drying', f.drying_status]">{{ DRYING_LABELS[f.drying_status] }}</td>
                <td>{{ f.location || '—' }}</td>
                <td class="actions">
                  <button class="icon-btn" title="Muokkaa" @click="startEdit(f)">✏️</button>
                  <button class="icon-btn" title="Poista" @click="removeFirewood(f)">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="col">
          <h3>🧖 Kiinteistön perustiedot & kiinteät kulut</h3>
          <p class="hint">
            Sauna, liittymät, jätehuolto ja kiinteistövero muokataan Kiinteistöt-välilehdellä.
          </p>
          <div class="cards">
            <div v-for="p in properties" :key="p.id" class="card">
              <div class="card-header">
                <strong>{{ p.name }}</strong>
                <span class="dim">{{ SAUNA_LABELS[p.sauna_type] }}</span>
              </div>
              <p v-if="p.sauna_info" class="kv dim italic">{{ p.sauna_info }}</p>
              <p class="kv dim">
                ⚡ {{ p.electricity_fuse || '—' }} · 💧 {{ p.water_connection || '—' }}
              </p>
              <p class="kv dim">
                🗑 {{ p.waste_provider || '—' }}<template v-if="p.waste_bin"> · {{ p.waste_bin }}</template
                ><template v-if="p.waste_interval"> / {{ p.waste_interval }}</template>
                · ♻ {{ BIOWASTE_LABELS[p.biowaste] }}
              </p>
              <p class="kv">
                Kiinteistövero: <strong class="amount">{{ (p.property_tax ?? 0).toFixed(0) }} €/v</strong>
                · Tiekunta: <strong class="amount">{{ (p.road_fee ?? 0).toFixed(0) }} €/v</strong>
              </p>
              <p v-if="compostFor(p.id)" :class="['kv', compostFor(p.id)?.level]">
                {{ compostFor(p.id)?.level === 'warning' ? '⚠' : '✔' }} {{ compostFor(p.id)?.message }}
              </p>
            </div>
          </div>
          <p class="totals-row">
            <span class="dim">Kiinteät vuosikulut yhteensä: </span>
            <strong class="amount-total">{{ fixedCostsTotal.toFixed(0) }} €/v</strong>
          </p>
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
h3 {
  margin-top: 0;
  color: var(--text-dim);
  font-size: 0.95rem;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.split {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.col {
  flex: 1;
  min-width: 320px;
}
.actions-row {
  margin-bottom: 0.75rem;
}
.totals-row {
  margin: 0.5rem 0 1rem;
  font-size: 0.85rem;
}
.ready {
  color: var(--green);
}
.total {
  color: var(--amber);
}
.dim {
  color: var(--text-dim);
}
.italic {
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
  min-width: 120px;
}
.form-actions {
  display: flex;
  gap: 0.5rem;
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
.drying.fresh {
  color: var(--red);
}
.drying.drying {
  color: var(--amber);
}
.drying.ready {
  color: var(--green);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.card {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.3rem;
}
.kv {
  margin: 0.15rem 0;
  font-size: 0.82rem;
}
.kv.warning {
  color: var(--amber);
}
.kv.ok {
  color: var(--green);
}
.amount,
.amount-total {
  color: var(--amber);
}
</style>
