<script setup lang="ts">
import { ref } from 'vue'
import { ApiError, setApiKey } from '../api'

const emit = defineEmits<{ authenticated: [] }>()

const key = ref('')
const error = ref('')
const checking = ref(false)

async function submit() {
  if (!key.value.trim()) return
  checking.value = true
  error.value = ''
  try {
    const res = await fetch('/api/properties', {
      headers: { Authorization: `Bearer ${key.value.trim()}` },
    })
    if (!res.ok) {
      throw new ApiError(res.status, 'Virheellinen API-avain')
    }
    setApiKey(key.value.trim())
    emit('authenticated')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Yhteysvirhe'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="panel login-box">
      <h1>🏡 Taloni</h1>
      <p class="hint">Syötä API-avain jatkaaksesi.</p>
      <form @submit.prevent="submit">
        <input
          v-model="key"
          type="password"
          placeholder="API-avain"
          autofocus
        />
        <button class="btn" type="submit" :disabled="checking">
          {{ checking ? 'Tarkistetaan…' : 'Kirjaudu' }}
        </button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="hint small">
        Avain löytyy palvelimelta: <code>~/.taloni/api_key</code>, tai se on
        asetettu <code>TALONI_API_KEY</code>-ympäristömuuttujalla.
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-box {
  width: 360px;
  text-align: center;
}
h1 {
  margin: 0 0 0.25rem;
  color: var(--cyan);
}
.hint {
  color: var(--text-dim);
  font-size: 0.9rem;
  margin: 0.25rem 0 1rem;
}
.hint.small {
  font-size: 0.75rem;
  margin-top: 1rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.error {
  color: var(--red);
  font-size: 0.85rem;
}
code {
  color: var(--cyan);
}
</style>
