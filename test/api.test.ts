import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

process.env.HOME = mkdtempSync(join(tmpdir(), 'taloni-api-'))
delete process.env.TALONI_API_KEY // varmistetaan levylle tallennettu-avain-polku, ei ympäristömuuttuja

let apiServer: Awaited<
  ReturnType<typeof import('../src/api/server.ts').createApiServer>
>
let baseUrl: string
let apiKey: string

before(async () => {
  const { createApiServer } = await import('../src/api/server.ts')
  apiServer = createApiServer({ host: '127.0.0.1', port: 0 })
  await apiServer.listen()
  const addr = apiServer.server.address()
  if (addr === null || typeof addr === 'string') {
    throw new Error('Odottamaton palvelimen osoite')
  }
  baseUrl = `http://127.0.0.1:${addr.port}`
  apiKey = readFileSync(
    join(process.env.HOME!, '.taloni', 'api_key'),
    'utf8',
  ).trim()
})

after(async () => {
  await apiServer.close()
})

function authedFetch(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
}

test('GET /health requires no auth and returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.status, 'ok')
})

test('unauthenticated requests to /api/* are rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/properties`)
  assert.equal(res.status, 401)
})

test('a wrong API key is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/properties`, {
    headers: { Authorization: 'Bearer not-the-real-key' },
  })
  assert.equal(res.status, 401)
})

test('GET /api/properties lists seeded properties', async () => {
  const res = await authedFetch('/api/properties')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body))
  assert.ok(body.length >= 3)
  assert.ok(body.some((p: { name: string }) => p.name === 'Metsäpirtti'))
})

test('unknown resource returns 404 with an available-resources list', async () => {
  const res = await authedFetch('/api/not_a_real_table')
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.ok(Array.isArray(body.available))
  assert.ok(body.available.includes('properties'))
})

test('full CRUD round-trip on /api/tasks', async () => {
  const propsRes = await authedFetch('/api/properties')
  const props = await propsRes.json()
  const propertyId = props[0].id

  const createRes = await authedFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      property_id: propertyId,
      title: 'API-testitehtävä',
      status: 'pending',
      priority: 'low',
      due_date: '2026-12-01',
      category: 'Testi',
      cost: 0,
      recurrence: 'none',
      next_due: null,
    }),
  })
  assert.equal(createRes.status, 201)
  const created = await createRes.json()
  assert.equal(created.title, 'API-testitehtävä')
  assert.ok(typeof created.id === 'number')

  const getRes = await authedFetch(`/api/tasks/${created.id}`)
  assert.equal(getRes.status, 200)
  assert.equal((await getRes.json()).title, 'API-testitehtävä')

  const updateRes = await authedFetch(`/api/tasks/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...created, title: 'Päivitetty otsikko' }),
  })
  assert.equal(updateRes.status, 200)
  assert.equal((await updateRes.json()).title, 'Päivitetty otsikko')

  const statusRes = await authedFetch(`/api/tasks/${created.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  })
  assert.equal(statusRes.status, 200)
  assert.equal((await statusRes.json()).status, 'completed')

  const deleteRes = await authedFetch(`/api/tasks/${created.id}`, {
    method: 'DELETE',
  })
  assert.equal(deleteRes.status, 204)

  const goneRes = await authedFetch(`/api/tasks/${created.id}`)
  assert.equal(goneRes.status, 404)
})

test('GET /api/tasks?property_id= filters results', async () => {
  const propsRes = await authedFetch('/api/properties')
  const props = await propsRes.json()
  const pappila = props.find((p: { name: string }) => p.name === 'Pappila')

  const res = await authedFetch(`/api/tasks?property_id=${pappila.id}`)
  const tasks = await res.json()
  assert.ok(tasks.length > 0)
  assert.ok(
    tasks.every((t: { property_id: number }) => t.property_id === pappila.id),
  )
})

test('a malformed JSON body returns 400, not a crash', async () => {
  const res = await authedFetch('/api/tasks', {
    method: 'POST',
    body: '{not valid json',
  })
  assert.equal(res.status, 400)
})

test('an unsupported method on a valid resource returns 405', async () => {
  const res = await authedFetch('/api/properties', { method: 'PATCH' })
  assert.equal(res.status, 405)
})

test('globalOnly resources (contacts) ignore property_id filtering', async () => {
  const res = await authedFetch('/api/contacts?property_id=999999')
  assert.equal(res.status, 200)
  const contacts = await res.json()
  assert.ok(contacts.length > 0) // ei tyhjä, koska property_id-suodatus ei koske globaaleja resursseja
})

test('GET /api/reports/portfolio returns the portfolio report', async () => {
  const res = await authedFetch('/api/reports/portfolio?year=2026')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.year, 2026)
  assert.ok(Array.isArray(body.rows))
  assert.ok(body.rows.length >= 3)
  assert.ok('totals' in body)
})

test('GET /api/reports/alerts returns upcoming/overdue obligations', async () => {
  const res = await authedFetch('/api/reports/alerts?days=90')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body))
  assert.ok(body.length > 0)
  assert.ok('daysUntil' in body[0])
})

test('GET /api/reports/renovations returns budget-vs-actual rows', async () => {
  const res = await authedFetch('/api/reports/renovations')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body))
  assert.ok(body.some((r: { projectName: string }) => r.projectName))
})

test('GET /api/reports/energy returns per-property efficiency rows', async () => {
  const res = await authedFetch('/api/reports/energy?year=2026')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body))
  assert.ok(body.some((r: { name: string }) => r.name === 'Metsäpirtti'))
})

test('GET /api/reports/wastewater returns systems with a compliance assessment', async () => {
  const res = await authedFetch('/api/reports/wastewater')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body))
  assert.ok(body.length > 0)
  assert.ok('assessment' in body[0])
  assert.ok(['ok', 'warning', 'action'].includes(body[0].assessment.level))
})

test('an unknown report name returns 404', async () => {
  const res = await authedFetch('/api/reports/bogus')
  assert.equal(res.status, 404)
})

test('POST /api/fireplaces/bulk-sweep logs a sweep for all fireplaces on a property except excluded ones', async () => {
  const props = await (await authedFetch('/api/properties')).json()
  const propertyId = props[0].id

  const created = await Promise.all(
    [1, 2].map(async (n) => {
      const res = await authedFetch('/api/fireplaces', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
          type: 'fireplace',
          name: `Bulk-sweep-testi ${n}`,
          last_sweep: null,
          next_sweep: null,
          sweeper: '',
        }),
      })
      return res.json()
    }),
  )

  const res = await authedFetch('/api/fireplaces/bulk-sweep', {
    method: 'POST',
    body: JSON.stringify({
      property_id: propertyId,
      date: '2026-01-15',
      excluded_ids: [created[1].id],
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.done >= 1)
  assert.equal(body.excluded, 1)

  const fireplaces = await (await authedFetch('/api/fireplaces')).json()
  const swept = fireplaces.find((f: { id: number }) => f.id === created[0].id)
  const excluded = fireplaces.find(
    (f: { id: number }) => f.id === created[1].id,
  )
  assert.equal(swept.last_sweep, '2026-01-15')
  assert.equal(swept.next_sweep, '2027-01-15')
  assert.equal(excluded.last_sweep, null)
})

test('report endpoints require auth like everything else under /api', async () => {
  const res = await fetch(`${baseUrl}/api/reports/portfolio`)
  assert.equal(res.status, 401)
})

test('the static web UI is served without auth', async () => {
  const res = await fetch(`${baseUrl}/`)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('<title>Taloni</title>'))
})

test('unknown non-/api paths fall back to the SPA shell (client-side routing)', async () => {
  const res = await fetch(`${baseUrl}/some/deep/link`)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('<title>Taloni</title>'))
})
