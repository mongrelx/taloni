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
