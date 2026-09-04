<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  api,
  type Fireplace,
  type HeatingSystem,
  type Property,
  type WastewaterSystemWithAssessment,
  type WaterTest,
} from '../api'

const section = ref<'fireplaces' | 'wastewater' | 'heating' | 'water_tests'>(
  'fireplaces',
)

const properties = ref<Property[]>([])
const fireplaces = ref<Fireplace[]>([])
const wastewater = ref<WastewaterSystemWithAssessment[]>([])
const heating = ref<HeatingSystem[]>([])
const waterTests = ref<WaterTest[]>([])
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
      fireplaces.value,
      wastewater.value,
      heating.value,
      waterTests.value,
    ] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Fireplace[]>('/api/fireplaces'),
      api.get<WastewaterSystemWithAssessment[]>('/api/reports/wastewater'),
      api.get<HeatingSystem[]>('/api/heating_systems'),
      api.get<WaterTest[]>('/api/water_tests'),
    ])
    for (const id of [
      newFpPropertyId,
      newWwPropertyId,
      newHeatPropertyId,
      newWtPropertyId,
      bulkPropertyId,
    ]) {
      if (id.value === null && properties.value[0])
        id.value = properties.value[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const today = new Date().toISOString().slice(0, 10)

// --- Tulisijat ---

const FIREPLACE_TYPES: Fireplace['type'][] = [
  'bakery_oven',
  'fireplace',
  'sauna_stove',
  'masonry_heater',
  'chimney',
  'kamina',
  'water_boiler',
  'wood_stove',
]
const FIREPLACE_LABELS: Record<Fireplace['type'], string> = {
  bakery_oven: 'Leivinuuni',
  fireplace: 'Takka',
  sauna_stove: 'Kiuas',
  masonry_heater: 'Varaava uuni',
  chimney: 'Hormi/piippu',
  kamina: 'Kamina',
  water_boiler: 'Muuripata / vesipata',
  wood_stove: 'Puuliesi',
}

const editingFpId = ref<number | null>(null)
const showFpForm = ref(false)
const newFpPropertyId = ref<number | null>(null)

const emptyFpForm = () => ({
  property_id: newFpPropertyId.value ?? 0,
  type: 'fireplace' as Fireplace['type'],
  name: '',
  last_sweep: '' as string,
  next_sweep: today,
  sweeper: '',
})
const fpForm = reactive(emptyFpForm())

function startAddFp() {
  editingFpId.value = null
  Object.assign(fpForm, emptyFpForm())
  showFpForm.value = true
}

function startEditFp(f: Fireplace) {
  editingFpId.value = f.id
  Object.assign(fpForm, {
    property_id: f.property_id,
    type: f.type,
    name: f.name,
    last_sweep: f.last_sweep ?? '',
    next_sweep: f.next_sweep ?? '',
    sweeper: f.sweeper,
  })
  showFpForm.value = true
}

function cancelFpForm() {
  showFpForm.value = false
  editingFpId.value = null
}

async function submitFpForm() {
  if (!fpForm.name.trim()) return
  submitting.value = true
  try {
    const payload = {
      ...fpForm,
      name: fpForm.name.trim(),
      last_sweep: fpForm.last_sweep || null,
      next_sweep: fpForm.next_sweep || null,
    }
    if (editingFpId.value === null) {
      await api.post('/api/fireplaces', payload)
    } else {
      await api.put(`/api/fireplaces/${editingFpId.value}`, payload)
    }
    showFpForm.value = false
    editingFpId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeFireplace(f: Fireplace) {
  if (!confirm(`Poistetaanko tulisija "${f.name}"?`)) return
  try {
    await api.del(`/api/fireplaces/${f.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Kertanuohous (bulk sweep) ---

const showBulkForm = ref(false)
const bulkPropertyId = ref<number | null>(null)
const bulkDate = ref(today)
const bulkExcluded = ref<Set<number>>(new Set())

const bulkFireplaces = computed(() =>
  fireplaces.value.filter((f) => f.property_id === bulkPropertyId.value),
)

function openBulkForm() {
  if (bulkPropertyId.value === null && properties.value[0]) {
    bulkPropertyId.value = properties.value[0].id
  }
  bulkDate.value = today
  bulkExcluded.value = new Set()
  showBulkForm.value = true
}

function toggleBulkExcluded(id: number) {
  const next = new Set(bulkExcluded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  bulkExcluded.value = next
}

async function submitBulkSweep() {
  if (bulkPropertyId.value === null || bulkFireplaces.value.length === 0) return
  submitting.value = true
  try {
    const result = await api.post<{ done: number; excluded: number }>(
      '/api/fireplaces/bulk-sweep',
      {
        property_id: bulkPropertyId.value,
        date: bulkDate.value,
        excluded_ids: [...bulkExcluded.value],
      },
    )
    showBulkForm.value = false
    await load()
    error.value = ''
    bulkResultMessage.value = `Nuohous kirjattu ${result.done} tulisijalle (${result.excluded} jätettiin pois).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}
const bulkResultMessage = ref('')

// --- Jätevesi ---

const WASTEWATER_TYPES: WastewaterSystemWithAssessment['type'][] = [
  'septic_tank',
  'sealed_tank',
  'soil_filter',
  'small_treatment',
  'mains_sewer',
]
const WASTEWATER_LABELS: Record<
  WastewaterSystemWithAssessment['type'],
  string
> = {
  septic_tank: 'Saostuskaivo',
  sealed_tank: 'Umpisäiliö',
  soil_filter: 'Maasuodattamo',
  small_treatment: 'Pienpuhdistamo',
  mains_sewer: 'Kunnan viemäri',
}
const ASSESSMENT_COLOR: Record<'ok' | 'warning' | 'action', string> = {
  ok: 'ok',
  warning: 'warning',
  action: 'action',
}

const editingWwId = ref<number | null>(null)
const showWwForm = ref(false)
const newWwPropertyId = ref<number | null>(null)

const emptyWwForm = () => ({
  property_id: newWwPropertyId.value ?? 0,
  type: 'septic_tank' as WastewaterSystemWithAssessment['type'],
  permit_info: '',
  last_emptied: '' as string,
  next_emptied: today,
  emptying_provider: '',
  build_year: 0,
  shoreline: 0 as 0 | 1,
  groundwater: 0 as 0 | 1,
  has_wc: 1 as 0 | 1,
  exemption: 0 as 0 | 1,
})
const wwForm = reactive(emptyWwForm())

function startAddWw() {
  editingWwId.value = null
  Object.assign(wwForm, emptyWwForm())
  showWwForm.value = true
}

function startEditWw(w: WastewaterSystemWithAssessment) {
  editingWwId.value = w.id
  Object.assign(wwForm, {
    property_id: w.property_id,
    type: w.type,
    permit_info: w.permit_info,
    last_emptied: w.last_emptied ?? '',
    next_emptied: w.next_emptied ?? '',
    emptying_provider: w.emptying_provider,
    build_year: w.build_year,
    shoreline: w.shoreline,
    groundwater: w.groundwater,
    has_wc: w.has_wc,
    exemption: w.exemption,
  })
  showWwForm.value = true
}

function cancelWwForm() {
  showWwForm.value = false
  editingWwId.value = null
}

async function submitWwForm() {
  submitting.value = true
  try {
    const payload = {
      ...wwForm,
      last_emptied: wwForm.last_emptied || null,
      next_emptied: wwForm.next_emptied || null,
    }
    if (editingWwId.value === null) {
      await api.post('/api/wastewater_systems', payload)
    } else {
      await api.put(`/api/wastewater_systems/${editingWwId.value}`, payload)
    }
    showWwForm.value = false
    editingWwId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeWastewater(w: WastewaterSystemWithAssessment) {
  if (
    !confirm(`Poistetaanko jätevesijärjestelmä (${WASTEWATER_LABELS[w.type]})?`)
  )
    return
  try {
    await api.del(`/api/wastewater_systems/${w.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Lämmitys ---

const HEATING_TYPES: HeatingSystem['type'][] = [
  'wood',
  'oil',
  'geothermal',
  'air_heat_pump',
  'electric',
  'district',
]
const HEATING_LABELS: Record<HeatingSystem['type'], string> = {
  wood: '🪵 Puulämmitys',
  oil: '🛢 Öljylämmitys',
  geothermal: '♨ Maalämpö',
  air_heat_pump: '🌀 Ilmalämpöpumppu',
  electric: '⚡ Sähkölämmitys',
  district: '🏭 Kaukolämpö',
}

const editingHeatId = ref<number | null>(null)
const showHeatForm = ref(false)
const newHeatPropertyId = ref<number | null>(null)

const emptyHeatForm = () => ({
  property_id: newHeatPropertyId.value ?? 0,
  type: 'wood' as HeatingSystem['type'],
  description: '',
  last_inspection: '' as string,
  next_inspection: '' as string,
})
const heatForm = reactive(emptyHeatForm())

function startAddHeat() {
  editingHeatId.value = null
  Object.assign(heatForm, emptyHeatForm())
  showHeatForm.value = true
}

function startEditHeat(h: HeatingSystem) {
  editingHeatId.value = h.id
  Object.assign(heatForm, {
    property_id: h.property_id,
    type: h.type,
    description: h.description,
    last_inspection: h.last_inspection ?? '',
    next_inspection: h.next_inspection ?? '',
  })
  showHeatForm.value = true
}

function cancelHeatForm() {
  showHeatForm.value = false
  editingHeatId.value = null
}

async function submitHeatForm() {
  submitting.value = true
  try {
    const payload = {
      ...heatForm,
      last_inspection: heatForm.last_inspection || null,
      next_inspection: heatForm.next_inspection || null,
    }
    if (editingHeatId.value === null) {
      await api.post('/api/heating_systems', payload)
    } else {
      await api.put(`/api/heating_systems/${editingHeatId.value}`, payload)
    }
    showHeatForm.value = false
    editingHeatId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeHeating(h: HeatingSystem) {
  if (!confirm(`Poistetaanko lämmitysjärjestelmä (${HEATING_LABELS[h.type]})?`))
    return
  try {
    await api.del(`/api/heating_systems/${h.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Kaivovesi ---

const editingWtId = ref<number | null>(null)
const showWtForm = ref(false)
const newWtPropertyId = ref<number | null>(null)

const emptyWtForm = () => ({
  property_id: newWtPropertyId.value ?? 0,
  test_date: today,
  ecoli: '',
  coliforms: '',
  nitrate: '',
  ph: '',
  iron: '',
  fluoride: '',
  passed: 1 as 0 | 1,
  notes: '',
})
const wtForm = reactive(emptyWtForm())

function startAddWt() {
  editingWtId.value = null
  Object.assign(wtForm, emptyWtForm())
  showWtForm.value = true
}

function startEditWt(wt: WaterTest) {
  editingWtId.value = wt.id
  Object.assign(wtForm, {
    property_id: wt.property_id,
    test_date: wt.test_date,
    ecoli: wt.ecoli,
    coliforms: wt.coliforms,
    nitrate: wt.nitrate,
    ph: wt.ph,
    iron: wt.iron,
    fluoride: wt.fluoride,
    passed: wt.passed,
    notes: wt.notes,
  })
  showWtForm.value = true
}

function cancelWtForm() {
  showWtForm.value = false
  editingWtId.value = null
}

async function submitWtForm() {
  submitting.value = true
  try {
    if (editingWtId.value === null) {
      await api.post('/api/water_tests', wtForm)
    } else {
      await api.put(`/api/water_tests/${editingWtId.value}`, wtForm)
    }
    showWtForm.value = false
    editingWtId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    submitting.value = false
  }
}

async function removeWaterTest(wt: WaterTest) {
  if (!confirm(`Poistetaanko vesitutkimus ${wt.test_date}?`)) return
  try {
    await api.del(`/api/water_tests/${wt.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// Suositus uusintanäytteestä 3 v viimeisimmästä tutkimuksesta per kiinteistö (kuten TUI:ssa).
const nextTestRecommendation = computed(() => {
  const latest = new Map<number, WaterTest>()
  for (const wt of waterTests.value) {
    const prev = latest.get(wt.property_id)
    if (!prev || wt.test_date > prev.test_date) latest.set(wt.property_id, wt)
  }
  const out = new Map<number, string>()
  for (const [pid, wt] of latest) {
    const y = parseInt(wt.test_date.slice(0, 4), 10) + 3
    out.set(pid, `${y}${wt.test_date.slice(4)}`)
  }
  return out
})
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🔧 Määräaikaishuolto</h2>
      <div class="section-toggle">
        <button
          :class="['tab-small', { active: section === 'fireplaces' }]"
          @click="section = 'fireplaces'"
        >
          Tulisijat
        </button>
        <button
          :class="['tab-small', { active: section === 'wastewater' }]"
          @click="section = 'wastewater'"
        >
          Jätevesi
        </button>
        <button
          :class="['tab-small', { active: section === 'heating' }]"
          @click="section = 'heating'"
        >
          Lämmitys
        </button>
        <button
          :class="['tab-small', { active: section === 'water_tests' }]"
          @click="section = 'water_tests'"
        >
          Kaivovesi
        </button>
      </div>
    </div>
    <p class="hint">
      Erääntyvät velvoitteet kaikista rekistereistä kootusti: katso
      Hälytykset-välilehti.
    </p>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="section === 'fireplaces'">
      <div class="actions-row">
        <button class="btn" @click="startAddFp">+ Lisää tulisija</button>
        <button class="btn-secondary" @click="openBulkForm">
          🧹 Kertanuohous koko kiinteistölle
        </button>
      </div>
      <p v-if="bulkResultMessage" class="hint success">{{ bulkResultMessage }}</p>

      <form v-if="showBulkForm" class="edit-form" @submit.prevent="submitBulkSweep">
        <select v-model.number="bulkPropertyId">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <input v-model="bulkDate" type="date" title="Nuohouspäivä" />
        <div class="bulk-list">
          <p v-if="bulkFireplaces.length === 0" class="hint">
            Ei tulisijoja valitulla kiinteistöllä.
          </p>
          <label v-for="f in bulkFireplaces" :key="f.id" class="bulk-item">
            <input
              type="checkbox"
              :checked="!bulkExcluded.has(f.id)"
              @change="toggleBulkExcluded(f.id)"
            />
            {{ f.name }} ({{ FIREPLACE_LABELS[f.type] }})
          </label>
        </div>
        <div class="form-actions">
          <button
            class="btn"
            type="submit"
            :disabled="submitting || bulkFireplaces.length === 0"
          >
            Kirjaa nuohous
          </button>
          <button class="btn-secondary" type="button" @click="showBulkForm = false">
            Peruuta
          </button>
        </div>
      </form>

      <form v-if="showFpForm" class="edit-form" @submit.prevent="submitFpForm">
        <select v-model.number="fpForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="fpForm.type">
          <option v-for="t in FIREPLACE_TYPES" :key="t" :value="t">
            {{ FIREPLACE_LABELS[t] }}
          </option>
        </select>
        <input v-model="fpForm.name" placeholder="Nimi (esim. Olohuoneen takka)" required />
        <input v-model="fpForm.sweeper" placeholder="Nuohooja" />
        <input v-model="fpForm.last_sweep" type="date" title="Viimeisin nuohous" />
        <input v-model="fpForm.next_sweep" type="date" title="Seuraava nuohous" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingFpId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelFpForm">Peruuta</button>
        </div>
      </form>

      <p v-if="fireplaces.length === 0" class="hint">Ei tulisijoja.</p>
      <table v-else>
        <thead>
          <tr>
            <th>Kiinteistö</th>
            <th>Nimi</th>
            <th>Tyyppi</th>
            <th>Viim. nuohous</th>
            <th>Seur. nuohous</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fireplaces" :key="f.id">
            <td>{{ propName(f.property_id) }}</td>
            <td>{{ f.name }}</td>
            <td>{{ FIREPLACE_LABELS[f.type] }}</td>
            <td>{{ f.last_sweep ?? '—' }}</td>
            <td>{{ f.next_sweep ?? '—' }}</td>
            <td class="actions">
              <button class="icon-btn" title="Muokkaa" @click="startEditFp(f)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeFireplace(f)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else-if="section === 'wastewater'">
      <div class="actions-row">
        <button class="btn" @click="startAddWw">+ Lisää järjestelmä</button>
      </div>
      <form v-if="showWwForm" class="edit-form" @submit.prevent="submitWwForm">
        <select v-model.number="wwForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="wwForm.type">
          <option v-for="t in WASTEWATER_TYPES" :key="t" :value="t">
            {{ WASTEWATER_LABELS[t] }}
          </option>
        </select>
        <input v-model="wwForm.emptying_provider" placeholder="Tyhjennyspalvelu" />
        <input v-model="wwForm.permit_info" placeholder="Lupatiedot" />
        <input v-model="wwForm.last_emptied" type="date" title="Viim. tyhjennys" />
        <input v-model="wwForm.next_emptied" type="date" title="Seur. tyhjennys" />
        <input
          v-model.number="wwForm.build_year"
          type="number"
          placeholder="Rakennusvuosi (0=ei tiedossa)"
        />
        <label class="check"><input v-model="wwForm.shoreline" type="checkbox" true-value="1" false-value="0" /> Ranta-alue</label>
        <label class="check"><input v-model="wwForm.groundwater" type="checkbox" true-value="1" false-value="0" /> Pohjavesialue</label>
        <label class="check"><input v-model="wwForm.has_wc" type="checkbox" true-value="1" false-value="0" /> Vesikäymälä</label>
        <label class="check"><input v-model="wwForm.exemption" type="checkbox" true-value="1" false-value="0" /> Vapautus voimassa</label>
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingWwId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelWwForm">Peruuta</button>
        </div>
      </form>

      <p v-if="wastewater.length === 0" class="hint">Ei jätevesijärjestelmiä.</p>
      <div v-else class="cards">
        <div v-for="w in wastewater" :key="w.id" :class="['card', ASSESSMENT_COLOR[w.assessment.level]]">
          <div class="card-header">
            <div>
              <strong>{{ WASTEWATER_LABELS[w.type] }}</strong>
              <span class="dim"> — {{ propName(w.property_id) }}</span>
            </div>
            <div class="actions">
              <span :class="['assessment-badge', w.assessment.level]">
                {{ w.assessment.level === 'ok' ? 'KUNNOSSA' : w.assessment.level === 'warning' ? 'HUOMIOITAVAA' : 'TOIMENPIDE TARPEEN' }}
              </span>
              <button class="icon-btn" title="Muokkaa" @click="startEditWw(w)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeWastewater(w)">🗑️</button>
            </div>
          </div>
          <p class="kv">{{ w.assessment.headline }}</p>
          <p class="kv dim" v-if="w.emptying_provider">
            Tyhjennyspalvelu: {{ w.emptying_provider }} · Seur. tyhjennys: {{ w.next_emptied ?? '—' }}
          </p>
          <ul v-if="w.assessment.issues.length" class="issue-list">
            <li v-for="(issue, i) in w.assessment.issues" :key="i">{{ issue }}</li>
          </ul>
          <ul v-if="w.assessment.actions.length" class="action-list">
            <li v-for="(action, i) in w.assessment.actions" :key="i">{{ action }}</li>
          </ul>
        </div>
      </div>
      <p class="hint disclaimer">
        Arvio on informatiivinen eikä viranomaispäätös — varmista vaatimukset kunnan ympäristönsuojeluviranomaiselta.
      </p>
    </template>

    <template v-else-if="section === 'heating'">
      <div class="actions-row">
        <button class="btn" @click="startAddHeat">+ Lisää lämmitysjärjestelmä</button>
      </div>
      <form v-if="showHeatForm" class="edit-form" @submit.prevent="submitHeatForm">
        <select v-model.number="heatForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="heatForm.type">
          <option v-for="t in HEATING_TYPES" :key="t" :value="t">{{ HEATING_LABELS[t] }}</option>
        </select>
        <input v-model="heatForm.description" placeholder="Kuvaus" />
        <input v-model="heatForm.last_inspection" type="date" title="Viim. tarkastus" />
        <input v-model="heatForm.next_inspection" type="date" title="Seur. tarkastus" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingHeatId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelHeatForm">Peruuta</button>
        </div>
      </form>

      <p v-if="heating.length === 0" class="hint">Ei lämmitysjärjestelmiä.</p>
      <table v-else>
        <thead>
          <tr>
            <th>Kiinteistö</th>
            <th>Tyyppi</th>
            <th>Kuvaus</th>
            <th>Seur. tarkastus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in heating" :key="h.id">
            <td>{{ propName(h.property_id) }}</td>
            <td>{{ HEATING_LABELS[h.type] }}</td>
            <td>{{ h.description }}</td>
            <td>{{ h.next_inspection ?? '—' }}</td>
            <td class="actions">
              <button class="icon-btn" title="Muokkaa" @click="startEditHeat(h)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeHeating(h)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <div class="actions-row">
        <button class="btn" @click="startAddWt">+ Lisää vesitutkimus</button>
      </div>
      <form v-if="showWtForm" class="edit-form" @submit.prevent="submitWtForm">
        <select v-model.number="wtForm.property_id">
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <input v-model="wtForm.test_date" type="date" title="Näytteenottopäivä" />
        <input v-model="wtForm.ecoli" placeholder="E.coli" />
        <input v-model="wtForm.coliforms" placeholder="Koliformit" />
        <input v-model="wtForm.nitrate" placeholder="Nitraatti (mg/l)" />
        <input v-model="wtForm.ph" placeholder="pH" />
        <input v-model="wtForm.iron" placeholder="Rauta (mg/l)" />
        <input v-model="wtForm.fluoride" placeholder="Fluoridi (mg/l)" />
        <label class="check">
          <input v-model="wtForm.passed" type="checkbox" true-value="1" false-value="0" /> Läpäisi vaatimukset
        </label>
        <input v-model="wtForm.notes" placeholder="Huomiot" />
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="submitting">
            {{ editingWtId === null ? 'Lisää' : 'Tallenna' }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelWtForm">Peruuta</button>
        </div>
      </form>

      <p v-if="waterTests.length === 0" class="hint">Ei vesitutkimuksia.</p>
      <div v-else class="cards">
        <div
          v-for="wt in waterTests"
          :key="wt.id"
          :class="['card', wt.passed ? 'ok' : 'action']"
        >
          <div class="card-header">
            <div>
              <strong>{{ propName(wt.property_id) }}</strong>
              <span class="dim"> — {{ wt.test_date }}</span>
            </div>
            <div class="actions">
              <span :class="['assessment-badge', wt.passed ? 'ok' : 'action']">
                {{ wt.passed ? 'HYVÄKSYTTY' : 'HUOMAUTUS' }}
              </span>
              <button class="icon-btn" title="Muokkaa" @click="startEditWt(wt)">✏️</button>
              <button class="icon-btn" title="Poista" @click="removeWaterTest(wt)">🗑️</button>
            </div>
          </div>
          <p class="kv dim">
            E.coli: {{ wt.ecoli }} · Koliformit: {{ wt.coliforms }} · NO₃: {{ wt.nitrate }} ·
            pH: {{ wt.ph }} · Fe: {{ wt.iron }} · F: {{ wt.fluoride }}
          </p>
          <p v-if="wt.notes" class="kv dim">{{ wt.notes }}</p>
        </div>
      </div>
      <p v-if="nextTestRecommendation.size" class="hint disclaimer">
        Suositeltu uusintanäyte (3 v viimeisimmästä):
        <span v-for="[pid, date] in nextTestRecommendation" :key="pid">
          {{ propName(pid) }}: {{ date }}<template v-if="pid !== [...nextTestRecommendation.keys()].at(-1)">, </template>
        </span>
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.section-toggle {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
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
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.hint {
  color: var(--text-dim);
  font-size: 0.85rem;
}
.hint.success {
  color: var(--green);
}
.hint.disclaimer {
  margin-top: 0.75rem;
  font-style: italic;
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
.check {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--text-dim);
  flex: 0;
  white-space: nowrap;
}
.check input {
  width: auto;
}
.form-actions {
  display: flex;
  gap: 0.5rem;
}
.bulk-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-panel);
  border-radius: 4px;
}
.bulk-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}
.bulk-item input {
  width: auto;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.card {
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-left: 4px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.card.ok {
  border-left-color: var(--green);
}
.card.warning {
  border-left-color: var(--amber);
}
.card.action {
  border-left-color: var(--red);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.dim {
  color: var(--text-dim);
}
.assessment-badge {
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}
.assessment-badge.ok {
  background: rgba(46, 204, 113, 0.2);
  color: var(--green);
}
.assessment-badge.warning {
  background: rgba(243, 156, 18, 0.2);
  color: var(--amber);
}
.assessment-badge.action {
  background: rgba(231, 76, 60, 0.2);
  color: var(--red);
}
.kv {
  margin: 0.2rem 0;
  font-size: 0.85rem;
}
.kv.dim {
  color: var(--text-dim);
}
.issue-list,
.action-list {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
}
.issue-list {
  color: var(--red);
}
.action-list {
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
