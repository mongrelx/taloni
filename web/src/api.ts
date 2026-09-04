// Ohut fetch-kääre taloni-REST-rajapinnalle. UI ja API jaetaan aina samasta originista
// (ks. vite.config.ts / src/api/server.ts staattinen tarjoilu), joten peruspolku on tyhjä.
const STORAGE_KEY = 'taloni_api_key'

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const key = getApiKey()
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data && (data as { error?: string }).error) || `HTTP ${res.status}`,
    )
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
}

// --- Tyypit (peilaa src/db/types.ts:ää — ei jaettu paketti, koska web/ on erillinen build) ---

export interface Property {
  id: number
  name: string
  kiinteistotunnus: string
  water_source: 'well' | 'mains'
  build_year: number
  location: string
  // Loput kentät eivät (vielä) ole web-UI:n muokattavissa (ks. issue #48) — kannettava
  // muuttumattomana läpi PUT-päivityksissä, koska updateProperty() vaatii koko rivin.
  sauna_type: 'none' | 'wood' | 'electric'
  sauna_info: string
  property_tax: number
  road_fee: number
  electricity_fuse: string
  water_connection: string
  waste_provider: string
  waste_bin: string
  waste_interval: string
  biowaste: 'collection' | 'home_compost' | 'shared' | 'none'
  compost_registered: 0 | 1
  compost_reg_date: string
  floor_area: number
  energy_rating: '' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  energy_cert_date: string
  energy_cert_valid_until: string
}

export interface Task {
  id: number
  property_id: number
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date: string
  category: string
  cost: number
  recurrence: string
  next_due: string | null
}

export interface Transaction {
  id: number
  property_id: number
  type: 'income' | 'expense'
  category: string
  amount: number
  date: string
  description: string
  renovation_id: number | null
}

export interface Renovation {
  id: number
  property_id: number
  project_name: string
  status: 'planning' | 'in_progress' | 'completed'
  budget: number
  spent: number
  start_date: string
  end_date: string | null
}

export interface RenovationBudgetRow {
  renovationId: number
  projectName: string
  propertyName: string
  status: string
  budget: number
  spent: number
  linkedExpenses: number
  variance: number
  overBudget: boolean
}

export interface Utility {
  id: number
  property_id: number
  type:
    | 'electric_siirto'
    | 'electric_energia'
    | 'water'
    | 'gas'
    | 'internet'
    | 'waste'
  amount: number
  billing_date: string
  billing_month: string
  usage_value: number
  provider: string
}

export interface Tool {
  id: number
  name: string
  status: 'working' | 'needs_repair' | 'lost'
  location: string
  purchase_date: string
}

export interface Insurance {
  id: number
  property_id: number
  policy_name: string
  provider: string
  premium: number
  renewal_date: string
  coverage_details: string
}

export interface Fireplace {
  id: number
  property_id: number
  type:
    | 'bakery_oven'
    | 'fireplace'
    | 'sauna_stove'
    | 'masonry_heater'
    | 'chimney'
    | 'kamina'
    | 'water_boiler'
    | 'wood_stove'
  name: string
  last_sweep: string | null
  next_sweep: string | null
  sweeper: string
}

export interface WastewaterSystem {
  id: number
  property_id: number
  type:
    | 'septic_tank'
    | 'sealed_tank'
    | 'soil_filter'
    | 'small_treatment'
    | 'mains_sewer'
  permit_info: string
  last_emptied: string | null
  next_emptied: string | null
  emptying_provider: string
  build_year: number
  shoreline: 0 | 1
  groundwater: 0 | 1
  has_wc: 0 | 1
  exemption: 0 | 1
}

export interface WastewaterAssessment {
  level: 'ok' | 'warning' | 'action'
  headline: string
  issues: string[]
  actions: string[]
}

export type WastewaterSystemWithAssessment = WastewaterSystem & {
  assessment: WastewaterAssessment
}

export interface HeatingSystem {
  id: number
  property_id: number
  type:
    | 'wood'
    | 'oil'
    | 'geothermal'
    | 'air_heat_pump'
    | 'electric'
    | 'district'
  description: string
  last_inspection: string | null
  next_inspection: string | null
}

export interface WaterTest {
  id: number
  property_id: number
  test_date: string
  ecoli: string
  coliforms: string
  nitrate: string
  ph: string
  iron: string
  fluoride: string
  passed: 0 | 1
  notes: string
}

export interface AlertRow {
  date: string
  daysUntil: number
  category: string
  label: string
  propertyName: string
}

export interface PortfolioRow {
  propertyId: number
  name: string
  kiinteistotunnus: string
  income: number
  expense: number
  net: number
  openTasks: number
  overdueTasks: number
  nights: number
  occupancyRate: number
  roi: number | null
  latestValue: number | null
  valueChangePercent: number | null
}

export interface PortfolioReport {
  year: number
  rows: PortfolioRow[]
  totals: {
    income: number
    expense: number
    net: number
    nights: number
    occupancyRate: number
  }
}
