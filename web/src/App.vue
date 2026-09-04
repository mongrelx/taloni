<script setup lang="ts">
import { ref } from 'vue'
import { clearApiKey, getApiKey } from './api'
import AlertsTab from './components/AlertsTab.vue'
import ComplianceTab from './components/ComplianceTab.vue'
import FinanceTab from './components/FinanceTab.vue'
import FirewoodTab from './components/FirewoodTab.vue'
import InsuranceTab from './components/InsuranceTab.vue'
import LoginScreen from './components/LoginScreen.vue'
import PortfolioTab from './components/PortfolioTab.vue'
import PropertiesTab from './components/PropertiesTab.vue'
import RentalTab from './components/RentalTab.vue'
import TasksTab from './components/TasksTab.vue'
import UtilitiesTab from './components/UtilitiesTab.vue'

type Tab =
  | 'properties'
  | 'tasks'
  | 'finance'
  | 'utilities'
  | 'insurance'
  | 'compliance'
  | 'firewood'
  | 'rental'
  | 'alerts'
  | 'portfolio'

const authenticated = ref(getApiKey() !== null)
const tab = ref<Tab>('properties')

const tabs: { id: Tab; label: string }[] = [
  { id: 'properties', label: '🏡 Kiinteistöt' },
  { id: 'tasks', label: '📋 Tehtävät' },
  { id: 'finance', label: '💰 Talous & Korjaukset' },
  { id: 'utilities', label: '🔌 Sähkö & Kulutus' },
  { id: 'insurance', label: '🛡 Vakuutus & Kalusto' },
  { id: 'compliance', label: '🔧 Määräaikaishuolto' },
  { id: 'firewood', label: '🪵 Polttopuu & Sauna' },
  { id: 'rental', label: '🏖 Vuokraus & Kausi' },
  { id: 'alerts', label: '⏰ Hälytykset' },
  { id: 'portfolio', label: '📊 Salkku' },
]

function logout() {
  clearApiKey()
  authenticated.value = false
}
</script>

<template>
  <LoginScreen
    v-if="!authenticated"
    @authenticated="authenticated = true"
  />
  <div v-else class="app">
    <header>
      <h1>🏠 Taloni</h1>
      <nav>
        <button
          v-for="t in tabs"
          :key="t.id"
          :class="['tab', { active: tab === t.id }]"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
      <button class="btn-secondary logout" @click="logout">Kirjaudu ulos</button>
    </header>
    <main>
      <PropertiesTab v-if="tab === 'properties'" />
      <TasksTab v-else-if="tab === 'tasks'" />
      <FinanceTab v-else-if="tab === 'finance'" />
      <UtilitiesTab v-else-if="tab === 'utilities'" />
      <InsuranceTab v-else-if="tab === 'insurance'" />
      <ComplianceTab v-else-if="tab === 'compliance'" />
      <FirewoodTab v-else-if="tab === 'firewood'" />
      <RentalTab v-else-if="tab === 'rental'" />
      <AlertsTab v-else-if="tab === 'alerts'" />
      <PortfolioTab v-else-if="tab === 'portfolio'" />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}
header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  color: var(--cyan);
  font-size: 1.4rem;
}
nav {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}
.tab {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}
.tab.active {
  border-color: var(--cyan);
  color: var(--cyan);
}
.logout {
  font-size: 0.8rem;
}
</style>
