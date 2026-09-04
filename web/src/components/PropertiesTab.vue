<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Property } from '../api'

const properties = ref<Property[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    properties.value = await api.get<Property[]>('/api/properties')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Virhe'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="panel">
    <h2>🏡 Kiinteistöt</h2>
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
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in properties" :key="p.id">
          <td>{{ p.name }}</td>
          <td>{{ p.kiinteistotunnus }}</td>
          <td>{{ p.water_source === 'well' ? 'Oma kaivo' : 'Kunnan vesi' }}</td>
          <td>{{ p.build_year }}</td>
          <td>{{ p.location }}</td>
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
.hint {
  color: var(--text-dim);
}
.error {
  color: var(--red);
}
</style>
