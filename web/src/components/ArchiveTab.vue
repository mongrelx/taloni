<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  api,
  type Contact,
  type Document,
  type DocumentLinkType,
  type Fireplace,
  type Insurance,
  type MeterReading,
  type Property,
  type WastewaterSystem,
  type WaterTest,
} from '../api'

const section = ref<'contacts' | 'documents' | 'meters'>('contacts')

const properties = ref<Property[]>([])
const contacts = ref<Contact[]>([])
const documents = ref<Document[]>([])
const meterReadings = ref<MeterReading[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[properties.value, contacts.value, documents.value, meterReadings.value] =
      await Promise.all([
        api.get<Property[]>('/api/properties'),
        api.get<Contact[]>('/api/contacts'),
        api.get<Document[]>('/api/documents'),
        api.get<MeterReading[]>('/api/meter_readings'),
      ])
    if (newDocPropertyId.value === null && properties.value[0]) {
      newDocPropertyId.value = properties.value[0].id
    }
    if (newMeterPropertyId.value === null && properties.value[0]) {
      newMeterPropertyId.value = properties.value[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const today = new Date().toISOString().slice(0, 10)

// --- Yhteystiedot ---

const CONTACT_ROLES: Contact['role'][] = [
  'nuohooja',
  'lvi',
  'sahko',
  'loka',
  'isannointi',
  'other',
]
const CONTACT_ROLE_LABELS: Record<Contact['role'], string> = {
  nuohooja: 'Nuohooja',
  lvi: 'LVI-asennus',
  sahko: 'Sähköasennus',
  loka: 'Loka-auto',
  isannointi: 'Isännöinti',
  other: 'Muu',
}

const editingContactId = ref<number | null>(null)
const showContactForm = ref(false)
const emptyContactForm = () => ({
  name: '',
  role: 'nuohooja' as Contact['role'],
  phone: '',
  email: '',
  notes: '',
})
const contactForm = reactive(emptyContactForm())

function startAddContact() {
  editingContactId.value = null
  Object.assign(contactForm, emptyContactForm())
  showContactForm.value = true
}
function startEditContact(c: Contact) {
  editingContactId.value = c.id
  Object.assign(contactForm, {
    name: c.name,
    role: c.role,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
  })
  showContactForm.value = true
}
function cancelContactForm() {
  showContactForm.value = false
  editingContactId.value = null
}
async function submitContactForm() {
  if (!contactForm.name.trim()) return
  submitting.value = true
  try {
    const payload = { ...contactForm, name: contactForm.name.trim() }
    if (editingContactId.value === null) {
      await api.post('/api/contacts', payload)
    } else {
      await api.put(`/api/contacts/${editingContactId.value}`, payload)
    }
    showContactForm.value = false
    editingContactId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}
async function removeContact(c: Contact) {
  if (!confirm(`Poistetaanko yhteystieto (${c.name})?`)) return
  try {
    await api.del(`/api/contacts/${c.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Asiakirjat ---

const DOC_TYPES: Document['doc_type'][] = [
  'deed',
  'purchase',
  'permit',
  'inspection',
  'warranty',
  'photo',
  'other',
]
const DOC_TYPE_LABELS: Record<Document['doc_type'], string> = {
  deed: 'Lainhuuto',
  purchase: 'Kauppakirja',
  permit: 'Rakennuslupa',
  inspection: 'Tarkastuspöytäkirja',
  warranty: 'Takuu',
  photo: 'Valokuva',
  other: 'Muu',
}
// Sama valittavissa oleva osajoukko kuin TUI:n lomakkeella (Dashboard.tsx DOC_LINK_TYPES) —
// 'renovation'/'task' ovat tuettuja tietomallissa, mutta eivät vielä kummankaan käyttöliittymän
// linkitysvalitsimessa.
const DOC_LINK_TYPES: DocumentLinkType[] = [
  '',
  'fireplace',
  'wastewater',
  'water_test',
  'insurance',
]
const DOC_LINK_LABELS: Record<DocumentLinkType, string> = {
  '': 'Ei linkitystä',
  fireplace: 'Tulisija',
  wastewater: 'Jätevesijärjestelmä',
  water_test: 'Vesitutkimus',
  insurance: 'Vakuutus',
  renovation: 'Remonttihanke',
  task: 'Tehtävä',
}
const WASTEWATER_LABELS: Record<WastewaterSystem['type'], string> = {
  septic_tank: 'Saostuskaivo',
  sealed_tank: 'Umpisäiliö',
  soil_filter: 'Maasuodattamo',
  small_treatment: 'Pienpuhdistamo',
  mains_sewer: 'Kunnallinen viemäri',
}

const editingDocId = ref<number | null>(null)
const showDocForm = ref(false)
const newDocPropertyId = ref<number | null>(null)
const linkCandidates = ref<{ id: number; label: string }[]>([])

const emptyDocForm = () => ({
  property_id: newDocPropertyId.value ?? 0,
  doc_type: 'other' as Document['doc_type'],
  title: '',
  file_path: '',
  issued_date: today,
  notes: '',
  linked_type: '' as DocumentLinkType,
  linked_id: 0,
})
const docForm = reactive(emptyDocForm())

async function loadLinkCandidates() {
  if (!docForm.linked_type || !docForm.property_id) {
    linkCandidates.value = []
    return
  }
  const pid = docForm.property_id
  try {
    if (docForm.linked_type === 'fireplace') {
      const rows = await api.get<Fireplace[]>(
        `/api/fireplaces?property_id=${pid}`,
      )
      linkCandidates.value = rows.map((f) => ({ id: f.id, label: f.name }))
    } else if (docForm.linked_type === 'wastewater') {
      const rows = await api.get<WastewaterSystem[]>(
        `/api/wastewater_systems?property_id=${pid}`,
      )
      linkCandidates.value = rows.map((w) => ({
        id: w.id,
        label: WASTEWATER_LABELS[w.type],
      }))
    } else if (docForm.linked_type === 'water_test') {
      const rows = await api.get<WaterTest[]>(
        `/api/water_tests?property_id=${pid}`,
      )
      linkCandidates.value = rows.map((t) => ({
        id: t.id,
        label: t.test_date,
      }))
    } else if (docForm.linked_type === 'insurance') {
      const rows = await api.get<Insurance[]>(
        `/api/insurance?property_id=${pid}`,
      )
      linkCandidates.value = rows.map((i) => ({
        id: i.id,
        label: i.policy_name,
      }))
    } else {
      linkCandidates.value = []
    }
  } catch {
    linkCandidates.value = []
  }
}
watch(
  () => [docForm.linked_type, docForm.property_id, showDocForm.value],
  () => {
    if (showDocForm.value) loadLinkCandidates()
  },
)

function startAddDoc() {
  editingDocId.value = null
  Object.assign(docForm, emptyDocForm())
  showDocForm.value = true
}
function startEditDoc(d: Document) {
  editingDocId.value = d.id
  Object.assign(docForm, {
    property_id: d.property_id,
    doc_type: d.doc_type,
    title: d.title,
    file_path: d.file_path,
    issued_date: d.issued_date,
    notes: d.notes,
    linked_type: d.linked_type,
    linked_id: d.linked_id,
  })
  showDocForm.value = true
}
function cancelDocForm() {
  showDocForm.value = false
  editingDocId.value = null
}
async function submitDocForm() {
  if (!docForm.title.trim()) return
  submitting.value = true
  try {
    const payload = { ...docForm, title: docForm.title.trim() }
    if (editingDocId.value === null) {
      await api.post('/api/documents', payload)
    } else {
      await api.put(`/api/documents/${editingDocId.value}`, payload)
    }
    showDocForm.value = false
    editingDocId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}
async function removeDoc(d: Document) {
  if (!confirm(`Poistetaanko asiakirja (${d.title})?`)) return
  try {
    await api.del(`/api/documents/${d.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

function linkLabelFor(d: Document): string | undefined {
  if (!d.linked_type) return undefined
  // Kevyt haku vain sen dokumentin lomakekohtaisesta ehdokaslistasta ei riitä listanäkymässä —
  // näytetään linkin tyyppi aina, ja tarkka kohde vain jos se sattuu olevan viimeksi ladatussa
  // ehdokaslistassa (sama kevyt lähestymistapa kuin TUI:n linkCandidates()-uudelleenhaku).
  return linkCandidates.value.find((c) => c.id === d.linked_id)?.label
}

// --- Mittarilukemat & kulutustrendi ---

const METER_TYPES: MeterReading['meter_type'][] = ['electric', 'water']
const METER_LABELS: Record<MeterReading['meter_type'], string> = {
  electric: '⚡ Sähkö',
  water: '💧 Vesi',
}
function meterUnit(t: MeterReading['meter_type']): string {
  return t === 'electric' ? 'kWh' : 'm³'
}

const editingMeterId = ref<number | null>(null)
const showMeterForm = ref(false)
const newMeterPropertyId = ref<number | null>(null)

const emptyMeterForm = () => ({
  property_id: newMeterPropertyId.value ?? 0,
  meter_type: 'electric' as MeterReading['meter_type'],
  reading: 0,
  reading_date: today,
  notes: '',
})
const meterForm = reactive(emptyMeterForm())

function startAddMeter() {
  editingMeterId.value = null
  Object.assign(meterForm, emptyMeterForm())
  showMeterForm.value = true
}
function startEditMeter(m: MeterReading) {
  editingMeterId.value = m.id
  Object.assign(meterForm, {
    property_id: m.property_id,
    meter_type: m.meter_type,
    reading: m.reading,
    reading_date: m.reading_date,
    notes: m.notes,
  })
  showMeterForm.value = true
}
function cancelMeterForm() {
  showMeterForm.value = false
  editingMeterId.value = null
}
async function submitMeterForm() {
  submitting.value = true
  try {
    if (editingMeterId.value === null) {
      await api.post('/api/meter_readings', { ...meterForm })
    } else {
      await api.put(`/api/meter_readings/${editingMeterId.value}`, {
        ...meterForm,
      })
    }
    showMeterForm.value = false
    editingMeterId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}
async function removeMeter(m: MeterReading) {
  if (
    !confirm(
      `Poistetaanko mittarilukema (${METER_LABELS[m.meter_type]}, ${m.reading_date})?`,
    )
  )
    return
  try {
    await api.del(`/api/meter_readings/${m.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// Kulutus = lukeman erotus edellisestä saman kohteen & mittarin lukemasta (nouseva
// päiväysjärjestys per kohde+mittari, sama periaate kuin TUI:ssa).
const meterRows = computed(() => {
  const sorted = [...meterReadings.value].sort((a, b) => {
    if (a.property_id !== b.property_id) return a.property_id - b.property_id
    if (a.meter_type !== b.meter_type)
      return a.meter_type.localeCompare(b.meter_type)
    return a.reading_date.localeCompare(b.reading_date)
  })
  const prevByKey = new Map<string, number>()
  return sorted.map((m) => {
    const key = `${m.property_id}:${m.meter_type}`
    const prev = prevByKey.get(key)
    prevByKey.set(key, m.reading)
    return {
      ...m,
      consumption: prev === undefined ? null : m.reading - prev,
    }
  })
})
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>📇 Yhteystiedot & Arkisto</h2>
      <div class="section-toggle">
        <button
          :class="['toggle-btn', { active: section === 'contacts' }]"
          @click="section = 'contacts'"
        >
          Yhteystiedot
        </button>
        <button
          :class="['toggle-btn', { active: section === 'documents' }]"
          @click="section = 'documents'"
        >
          Asiakirjat
        </button>
        <button
          :class="['toggle-btn', { active: section === 'meters' }]"
          @click="section = 'meters'"
        >
          Mittarilukemat
        </button>
      </div>
    </div>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <!-- Yhteystiedot -->
      <div v-if="section === 'contacts'">
        <div class="actions-row">
          <button class="btn" @click="startAddContact">+ Lisää yhteystieto</button>
        </div>
        <form
          v-if="showContactForm"
          class="edit-form"
          @submit.prevent="submitContactForm"
        >
          <input v-model="contactForm.name" placeholder="Nimi" required />
          <select v-model="contactForm.role">
            <option v-for="r in CONTACT_ROLES" :key="r" :value="r">
              {{ CONTACT_ROLE_LABELS[r] }}
            </option>
          </select>
          <input v-model="contactForm.phone" placeholder="Puhelin" />
          <input v-model="contactForm.email" placeholder="Sähköposti" />
          <input v-model="contactForm.notes" placeholder="Huomiot" />
          <div class="form-actions">
            <button class="btn" type="submit" :disabled="submitting">
              {{ editingContactId === null ? 'Lisää' : 'Tallenna' }}
            </button>
            <button class="btn-secondary" type="button" @click="cancelContactForm">
              Peruuta
            </button>
          </div>
        </form>

        <p v-if="contacts.length === 0" class="hint">Ei yhteystietoja.</p>
        <div v-else class="cards">
          <div v-for="c in contacts" :key="c.id" class="card">
            <div class="card-header">
              <strong>{{ c.name }}</strong>
              <span class="role-badge">{{ CONTACT_ROLE_LABELS[c.role] }}</span>
            </div>
            <p class="kv dim">
              {{ c.phone || '—' }}<template v-if="c.email"> · {{ c.email }}</template>
            </p>
            <p v-if="c.notes" class="kv dim italic">{{ c.notes }}</p>
            <div class="card-actions">
              <button class="icon-btn" title="Muokkaa" @click="startEditContact(c)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeContact(c)">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Asiakirjat -->
      <div v-else-if="section === 'documents'">
        <div class="actions-row">
          <button class="btn" @click="startAddDoc">+ Lisää asiakirja</button>
        </div>
        <form v-if="showDocForm" class="edit-form" @submit.prevent="submitDocForm">
          <select v-model.number="docForm.property_id">
            <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-model="docForm.doc_type">
            <option v-for="t in DOC_TYPES" :key="t" :value="t">{{ DOC_TYPE_LABELS[t] }}</option>
          </select>
          <input v-model="docForm.title" placeholder="Otsikko" required />
          <input v-model="docForm.file_path" placeholder="Tiedostopolku (esim. ~/Documents/lainhuuto.pdf)" />
          <input v-model="docForm.issued_date" type="date" title="Päiväys" />
          <select
            v-model="docForm.linked_type"
            @change="docForm.linked_id = 0"
          >
            <option v-for="lt in DOC_LINK_TYPES" :key="lt" :value="lt">
              {{ DOC_LINK_LABELS[lt] }}
            </option>
          </select>
          <select
            v-if="docForm.linked_type"
            v-model.number="docForm.linked_id"
          >
            <option :value="0">— Valitse —</option>
            <option v-for="c in linkCandidates" :key="c.id" :value="c.id">
              {{ c.label }}
            </option>
          </select>
          <input v-model="docForm.notes" placeholder="Huomiot" />
          <div class="form-actions">
            <button class="btn" type="submit" :disabled="submitting">
              {{ editingDocId === null ? 'Lisää' : 'Tallenna' }}
            </button>
            <button class="btn-secondary" type="button" @click="cancelDocForm">Peruuta</button>
          </div>
        </form>

        <p v-if="documents.length === 0" class="hint">Ei asiakirjoja.</p>
        <div v-else class="cards">
          <div v-for="d in documents" :key="d.id" class="card">
            <div class="card-header">
              <strong>{{ d.title }}</strong>
              <span class="role-badge">{{ DOC_TYPE_LABELS[d.doc_type] }}</span>
            </div>
            <p class="kv dim">
              {{ propName(d.property_id) }}
              <template v-if="d.issued_date"> · {{ d.issued_date }}</template>
            </p>
            <p v-if="d.linked_type" class="kv link">
              🔗 {{ DOC_LINK_LABELS[d.linked_type] }}
              <template v-if="linkLabelFor(d)">: {{ linkLabelFor(d) }}</template>
            </p>
            <p v-if="d.notes" class="kv dim italic">{{ d.notes }}</p>
            <div class="card-actions">
              <a
                v-if="d.file_path"
                class="btn-secondary file-link"
                :href="`/api/documents/${d.id}/file`"
                target="_blank"
                rel="noopener"
              >
                📎 Avaa tiedosto
              </a>
              <button class="icon-btn" title="Muokkaa" @click="startEditDoc(d)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeDoc(d)">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Mittarilukemat -->
      <div v-else>
        <p class="hint">
          Kulutus = lukeman erotus edellisestä saman kohteen ja mittarin lukemasta.
        </p>
        <div class="actions-row">
          <button class="btn" @click="startAddMeter">+ Lisää mittarilukema</button>
        </div>
        <form v-if="showMeterForm" class="edit-form" @submit.prevent="submitMeterForm">
          <select v-model.number="meterForm.property_id">
            <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-model="meterForm.meter_type">
            <option v-for="t in METER_TYPES" :key="t" :value="t">{{ METER_LABELS[t] }}</option>
          </select>
          <input v-model.number="meterForm.reading" type="number" step="0.01" placeholder="Lukema" />
          <input v-model="meterForm.reading_date" type="date" title="Lukemapäivä" />
          <input v-model="meterForm.notes" placeholder="Huomiot" />
          <div class="form-actions">
            <button class="btn" type="submit" :disabled="submitting">
              {{ editingMeterId === null ? 'Lisää' : 'Tallenna' }}
            </button>
            <button class="btn-secondary" type="button" @click="cancelMeterForm">Peruuta</button>
          </div>
        </form>

        <p v-if="meterRows.length === 0" class="hint">Ei mittarilukemia.</p>
        <table v-else>
          <thead>
            <tr>
              <th>Kohde</th>
              <th>Mittari</th>
              <th>Pvm</th>
              <th>Lukema</th>
              <th>Kulutus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in meterRows" :key="m.id">
              <td>{{ propName(m.property_id) }}</td>
              <td>{{ METER_LABELS[m.meter_type] }}</td>
              <td>{{ m.reading_date }}</td>
              <td>{{ m.reading }} {{ meterUnit(m.meter_type) }}</td>
              <td class="dim">
                <template v-if="m.consumption !== null">
                  {{ m.consumption >= 0 ? '+' : '' }}{{ m.consumption.toFixed(1) }} {{ meterUnit(m.meter_type) }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="actions">
                <button class="icon-btn" title="Muokkaa" @click="startEditMeter(m)">✏️</button>
                <button class="icon-btn" title="Poista" @click="removeMeter(m)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
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
.toggle-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
}
.toggle-btn.active {
  border-color: var(--cyan);
  color: var(--cyan);
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
.actions-row {
  margin-bottom: 0.75rem;
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
.role-badge {
  color: var(--amber);
  font-size: 0.8rem;
}
.kv {
  margin: 0.15rem 0;
  font-size: 0.82rem;
}
.kv.link {
  color: var(--cyan);
}
.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.file-link {
  font-size: 0.78rem;
  padding: 0.15rem 0.5rem;
  text-decoration: none;
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
.actions {
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
}
</style>
