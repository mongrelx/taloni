<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, type Property } from '../api'

const properties = ref<Property[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

const editingId = ref<number | null>(null)
const showForm = ref(false)

const SAUNA_TYPES: Property['sauna_type'][] = ['none', 'wood', 'electric']
const SAUNA_LABELS: Record<Property['sauna_type'], string> = {
  none: 'Ei saunaa',
  wood: '🔥 Puukiuas',
  electric: '⚡ Sähkökiuas',
}
const BIOWASTE_OPTIONS: Property['biowaste'][] = [
  'collection',
  'home_compost',
  'shared',
  'none',
]
const BIOWASTE_LABELS: Record<Property['biowaste'], string> = {
  collection: 'Kunnan keräys',
  home_compost: 'Kotikompostointi',
  shared: 'Yhteiskeräyspiste',
  none: 'Ei biojätettä',
}

const emptyForm = () => ({
  name: '',
  kiinteistotunnus: '',
  water_source: 'well' as 'well' | 'mains',
  build_year: new Date().getFullYear(),
  location: 'Suomi',
  sauna_type: 'none' as Property['sauna_type'],
  sauna_info: '',
  electricity_fuse: '',
  water_connection: '',
  waste_provider: '',
  waste_bin: '',
  waste_interval: '',
  biowaste: 'collection' as Property['biowaste'],
  compost_registered: 0 as 0 | 1,
  compost_reg_date: '',
  property_tax: 0,
  road_fee: 0,
})
const form = reactive(emptyForm())

async function load() {
  loading.value = true
  try {
    properties.value = await api.get<Property[]>('/api/properties')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function startAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  showForm.value = true
}

function startEdit(p: Property) {
  editingId.value = p.id
  Object.assign(form, {
    name: p.name,
    kiinteistotunnus: p.kiinteistotunnus,
    water_source: p.water_source,
    build_year: p.build_year,
    location: p.location,
    sauna_type: p.sauna_type,
    sauna_info: p.sauna_info,
    electricity_fuse: p.electricity_fuse,
    water_connection: p.water_connection,
    waste_provider: p.waste_provider,
    waste_bin: p.waste_bin,
    waste_interval: p.waste_interval,
    biowaste: p.biowaste,
    compost_registered: p.compost_registered,
    compost_reg_date: p.compost_reg_date,
    property_tax: p.property_tax,
    road_fee: p.road_fee,
  })
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function submitForm() {
  if (!form.name.trim() || !form.kiinteistotunnus.trim()) return
  submitting.value = true
  try {
    if (editingId.value === null) {
      await api.post('/api/properties', { ...form })
    } else {
      // updateProperty() kirjoittaa koko rivin — säilytetään alkuperäisen tietueen
      // energiatodistus-kentät (ei vielä muokattavissa web-UI:sta) muuttumattomina.
      const existing = properties.value.find((p) => p.id === editingId.value)
      await api.put(`/api/properties/${editingId.value}`, {
        ...existing,
        ...form,
      })
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

async function removeProperty(p: Property) {
  if (
    !confirm(
      `Poistetaanko kiinteistö "${p.name}"? Tämä poistaa myös kaikki siihen liittyvät tehtävät, tapahtumat ja muut tiedot.`,
    )
  )
    return
  try {
    await api.del(`/api/properties/${p.id}`)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  }
}
</script>

<template>
  <div class="panel">
    <div class="header-row">
      <h2>🏡 Kiinteistöt</h2>
      <button class="btn" @click="startAdd">+ Lisää kiinteistö</button>
    </div>

    <form v-if="showForm" class="edit-form" @submit.prevent="submitForm">
      <input v-model="form.name" placeholder="Nimi" required />
      <input
        v-model="form.kiinteistotunnus"
        placeholder="Kiinteistötunnus (esim. 405-412-1-23)"
        required
      />
      <select v-model="form.water_source">
        <option value="well">Oma kaivo</option>
        <option value="mains">Kunnan vesi</option>
      </select>
      <input v-model.number="form.build_year" type="number" placeholder="Rakennusvuosi" />
      <input v-model="form.location" placeholder="Sijainti" />
      <select v-model="form.sauna_type">
        <option v-for="t in SAUNA_TYPES" :key="t" :value="t">{{ SAUNA_LABELS[t] }}</option>
      </select>
      <input v-model="form.sauna_info" placeholder="Saunan lisätiedot" />
      <input v-model="form.electricity_fuse" placeholder="Sähköliittymä (pääsulake)" />
      <input v-model="form.water_connection" placeholder="Vesiliittymä" />
      <input v-model="form.waste_provider" placeholder="Jätehuoltoyhtiö" />
      <input v-model="form.waste_bin" placeholder="Sekajäteastian koko" />
      <input v-model="form.waste_interval" placeholder="Tyhjennysväli" />
      <select v-model="form.biowaste">
        <option v-for="b in BIOWASTE_OPTIONS" :key="b" :value="b">{{ BIOWASTE_LABELS[b] }}</option>
      </select>
      <label v-if="form.biowaste === 'home_compost'" class="check">
        <input v-model="form.compost_registered" type="checkbox" true-value="1" false-value="0" />
        Kompostointi-ilmoitus tehty
      </label>
      <input
        v-if="form.biowaste === 'home_compost' && form.compost_registered"
        v-model="form.compost_reg_date"
        type="date"
        title="Ilmoituspäivä"
      />
      <input
        v-model.number="form.property_tax"
        type="number"
        step="0.01"
        placeholder="Kiinteistövero €/v"
      />
      <input
        v-model.number="form.road_fee"
        type="number"
        step="0.01"
        placeholder="Tiekunta/yksityistiemaksu €/v"
      />
      <div class="form-actions">
        <button class="btn" type="submit" :disabled="submitting">
          {{ editingId === null ? 'Lisää' : 'Tallenna' }}
        </button>
        <button class="btn-secondary" type="button" @click="cancelForm">Peruuta</button>
      </div>
    </form>

    <p v-if="loading" class="hint">Ladataan…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr>
          <th>Nimi</th>
          <th>Kiinteistötunnus</th>
          <th>Vesi</th>
          <th>Rakennusvuosi</th>
          <th>Sijainti</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in properties" :key="p.id">
          <td>{{ p.name }}</td>
          <td>{{ p.kiinteistotunnus }}</td>
          <td>{{ p.water_source === 'well' ? 'Oma kaivo' : 'Kunnan vesi' }}</td>
          <td>{{ p.build_year }}</td>
          <td>{{ p.location }}</td>
          <td class="actions">
            <button class="icon-btn" title="Muokkaa" @click="startEdit(p)">✏️</button>
            <button class="icon-btn" title="Poista" @click="removeProperty(p)">🗑️</button>
          </td>
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
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.header-row h2 {
  margin: 0;
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
  min-width: 140px;
}
.form-actions {
  display: flex;
  gap: 0.5rem;
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
.hint {
  color: var(--text-dim);
}
.error {
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
</style>
