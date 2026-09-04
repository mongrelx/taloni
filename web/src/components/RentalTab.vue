<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ApiError,
  api,
  type Booking,
  type Property,
  type SeasonalChecklistResult,
} from '../api'

const properties = ref<Property[]>([])
const bookings = ref<Booking[]>([])
const loading = ref(true)
const error = ref('')
const notification = ref('')
const submitting = ref(false)

function propName(id: number): string {
  return properties.value.find((p) => p.id === id)?.name ?? `#${id}`
}

async function load() {
  loading.value = true
  try {
    ;[properties.value, bookings.value] = await Promise.all([
      api.get<Property[]>('/api/properties'),
      api.get<Booking[]>('/api/bookings'),
    ])
    bookings.value.sort((a, b) => a.start_date.localeCompare(b.start_date))
    if (selectedPropertyId.value === null && properties.value[0]) {
      selectedPropertyId.value = properties.value[0].id
    }
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

// --- Varauslomake ---

const STATUSES: Booking['status'][] = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
]
const STATUS_LABELS: Record<Booking['status'], string> = {
  tentative: 'Alustava',
  confirmed: 'Vahvistettu',
  completed: 'Valmis',
  cancelled: 'Peruttu',
}

const editingId = ref<number | null>(null)
const showForm = ref(false)
const newPropertyId = ref<number | null>(null)

const emptyForm = () => ({
  property_id: newPropertyId.value ?? 0,
  guest_name: '',
  start_date: today,
  end_date: today,
  price: 0,
  status: 'tentative' as Booking['status'],
  income_recorded: 0 as 0 | 1,
  notes: '',
})
const form = reactive(emptyForm())

function startAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  showForm.value = true
}

function startEdit(b: Booking) {
  editingId.value = b.id
  Object.assign(form, {
    property_id: b.property_id,
    guest_name: b.guest_name,
    start_date: b.start_date,
    end_date: b.end_date,
    price: b.price,
    status: b.status,
    income_recorded: b.income_recorded,
    notes: b.notes,
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
      await api.post('/api/bookings', { ...form })
    } else {
      await api.put(`/api/bookings/${editingId.value}`, { ...form })
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

async function removeBooking(b: Booking) {
  if (!confirm(`Poistetaanko varaus (${b.guest_name}, ${b.start_date})?`))
    return
  try {
    await api.del(`/api/bookings/${b.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}

// --- Öiden laskenta (sama kuin backendin bookingNights()) ---
function nights(b: Booking): number {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(b.start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.end_date)
  )
    return 0
  const ms =
    new Date(`${b.end_date}T00:00:00Z`).getTime() -
    new Date(`${b.start_date}T00:00:00Z`).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

// --- Kalenterinäkymä: kuukausittainen ryhmittely ---

const MONTHS_FI = [
  '',
  'Tammikuu',
  'Helmikuu',
  'Maaliskuu',
  'Huhtikuu',
  'Toukokuu',
  'Kesäkuu',
  'Heinäkuu',
  'Elokuu',
  'Syyskuu',
  'Lokakuu',
  'Marraskuu',
  'Joulukuu',
]

const activeBookings = computed(() =>
  bookings.value.filter((b) => b.status !== 'cancelled'),
)
const totalNights = computed(() =>
  activeBookings.value.reduce((s, b) => s + nights(b), 0),
)
const grossIncome = computed(() =>
  activeBookings.value.reduce((s, b) => s + b.price, 0),
)
const recordedIncome = computed(() =>
  bookings.value
    .filter((b) => b.income_recorded)
    .reduce((s, b) => s + b.price, 0),
)

const monthGroups = computed(() => {
  const months = [
    ...new Set(bookings.value.map((b) => b.start_date.slice(0, 7))),
  ].sort()
  return months.map((month) => {
    const [y, m] = month.split('-')
    return {
      key: month,
      label: `${MONTHS_FI[Number.parseInt(m ?? '0', 10)] ?? month} ${y}`,
      bookings: bookings.value.filter(
        (b) => b.start_date.slice(0, 7) === month,
      ),
    }
  })
})

async function recordIncome(b: Booking) {
  try {
    await api.post(`/api/bookings/${b.id}/record-income`, {})
    notification.value = `Vuokratulo ${b.price.toFixed(2)} € kirjattu taloustapahtumaksi.`
    await load()
  } catch (e) {
    notification.value =
      e instanceof ApiError ? e.message : 'Tulon kirjaus epäonnistui.'
  }
}

// --- Kausikatsaukset ---

const selectedPropertyId = ref<number | null>(null)
const generatingSeason = ref<'spring' | 'autumn' | null>(null)

async function generateChecklist(season: 'spring' | 'autumn') {
  if (selectedPropertyId.value === null) {
    notification.value = 'Valitse ensin kohde.'
    return
  }
  generatingSeason.value = season
  try {
    const result = await api.post<SeasonalChecklistResult>(
      '/api/bookings/seasonal-checklist',
      { property_id: selectedPropertyId.value, season },
    )
    notification.value = `${result.label}: luotiin ${result.created} tehtävää (eräpäivä ${result.dueDate}). Katso Tehtävät-välilehti.`
  } catch (e) {
    notification.value =
      e instanceof ApiError ? e.message : 'Tarkistuslistan luonti epäonnistui.'
  } finally {
    generatingSeason.value = null
  }
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🏖 Vuokraus & Kausi</h2>
    </div>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <p v-if="notification" class="notification">{{ notification }}</p>

      <div class="split">
        <div class="col">
          <div class="actions-row">
            <button class="btn" @click="startAdd">+ Lisää varaus</button>
          </div>
          <div class="totals-row">
            <span class="dim">Yöt: </span>
            <strong class="nights">{{ totalNights }}</strong>
            <span class="dim"> | Brutto: </span>
            <strong class="gross">{{ grossIncome.toFixed(0) }} €</strong>
            <span class="dim"> | Kirjattu: </span>
            <strong class="recorded">{{ recordedIncome.toFixed(0) }} €</strong>
          </div>

          <form v-if="showForm" class="edit-form" @submit.prevent="submitForm">
            <select v-model.number="form.property_id">
              <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <input v-model="form.guest_name" placeholder="Varaajan nimi" required />
            <input v-model="form.start_date" type="date" title="Saapuminen" />
            <input v-model="form.end_date" type="date" title="Lähtö" />
            <input v-model.number="form.price" type="number" step="0.01" placeholder="Hinta €" />
            <select v-model="form.status">
              <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
            </select>
            <input v-model="form.notes" placeholder="Huomiot" />
            <div class="form-actions">
              <button class="btn" type="submit" :disabled="submitting">
                {{ editingId === null ? 'Lisää' : 'Tallenna' }}
              </button>
              <button class="btn-secondary" type="button" @click="cancelForm">Peruuta</button>
            </div>
          </form>

          <p v-if="bookings.length === 0" class="hint">Ei varauksia.</p>
          <div v-else class="calendar">
            <div v-for="g in monthGroups" :key="g.key" class="month-group">
              <div class="month-label">{{ g.label }}</div>
              <div v-for="b in g.bookings" :key="b.id" class="booking-row">
                <span class="dates">{{ b.start_date.slice(5) }}→{{ b.end_date.slice(5) }}</span>
                <span class="guest">{{ b.guest_name }}</span>
                <span class="prop dim">{{ propName(b.property_id) }}</span>
                <span class="nights-cell dim">{{ nights(b) }} yö</span>
                <span class="price">{{ b.price.toFixed(0) }} €</span>
                <span :class="['status', b.status]">{{ STATUS_LABELS[b.status] }}</span>
                <span v-if="b.income_recorded" class="recorded-badge">€✓</span>
                <span class="actions">
                  <button
                    v-if="!b.income_recorded && b.status !== 'cancelled' && b.price > 0"
                    class="icon-btn"
                    title="Kirjaa vuokratulo"
                    @click="recordIncome(b)"
                  >
                    💶
                  </button>
                  <button class="icon-btn" title="Muokkaa" @click="startEdit(b)">✏️</button>
                  <button class="icon-btn" title="Poista" @click="removeBooking(b)">🗑️</button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="col">
          <h3>🍂 Kausikatsaukset</h3>
          <p class="hint">
            Luo valmis tarkistuslista tehtävinä valitulle kohteelle.
          </p>
          <select v-model.number="selectedPropertyId" class="property-select">
            <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <div class="checklist-actions">
            <button
              class="btn"
              :disabled="generatingSeason !== null"
              @click="generateChecklist('spring')"
            >
              🌱 Kevätavaus
            </button>
            <button
              class="btn"
              :disabled="generatingSeason !== null"
              @click="generateChecklist('autumn')"
            >
              🍁 Syyssulku
            </button>
          </div>
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
.nights {
  color: var(--cyan);
}
.gross {
  color: var(--green);
}
.recorded {
  color: #3498db;
}
.dim {
  color: var(--text-dim);
}
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
.notification {
  color: var(--cyan);
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
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
.calendar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.month-label {
  font-weight: bold;
  color: var(--cyan);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.25rem;
  margin-bottom: 0.35rem;
}
.booking-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  padding: 0.3rem 0;
  flex-wrap: wrap;
}
.dates {
  color: #ddd;
  min-width: 90px;
}
.guest {
  font-weight: bold;
  min-width: 100px;
}
.price {
  color: var(--green);
}
.recorded-badge {
  color: #3498db;
  font-size: 0.8rem;
}
.status {
  font-weight: bold;
  font-size: 0.8rem;
}
.status.tentative {
  color: var(--amber);
}
.status.confirmed {
  color: var(--green);
}
.status.completed {
  color: #3498db;
}
.status.cancelled {
  color: var(--red);
}
.actions {
  display: flex;
  gap: 0.3rem;
  margin-left: auto;
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
.property-select {
  width: 100%;
  margin-bottom: 0.75rem;
}
.checklist-actions {
  display: flex;
  gap: 0.6rem;
}
</style>
