<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, type Property } from '../api'

const properties = ref<Property[]>([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)

const editingId = ref<number | null>(null)
const showForm = ref(false)

const emptyForm = () => ({
  name: '',
  kiinteistotunnus: '',
  water_source: 'well' as 'well' | 'mains',
  build_year: new Date().getFullYear(),
  location: 'Suomi',
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
      // muut kentät (sauna, jätehuolto, energiatodistus ym.) muuttumattomina.
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
