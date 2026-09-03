import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { before, test } from 'node:test'

process.env.HOME = mkdtempSync(join(tmpdir(), 'taloni-report-'))

let db: typeof import('../src/db/index.ts')
let report: typeof import('../src/report.ts')

before(async () => {
  db = await import('../src/db/index.ts')
  report = await import('../src/report.ts')
  db.initDb()
})

test('annualReport aggregates seeded 2026 transactions', () => {
  const r = report.annualReport(2026)
  assert.equal(r.year, 2026)
  // Siemenaineiston tulot: 650 + 1200 + 350 = 2200
  assert.equal(r.totalIncome, 2200)
  assert.ok(r.totalExpense > 0)
  assert.equal(r.net, r.totalIncome - r.totalExpense)
  assert.equal(r.byProperty.length, 3)
})

test('rentalIncomeReport sums Vuokraus income per property', () => {
  const r = report.rentalIncomeReport(2026)
  // Siemenaineiston vuokratulot: Metsäpirtti 650 + Pappila 1200 = 1850
  assert.equal(r.total, 1850)
  assert.ok(r.rows.every((row) => row.rentalIncome > 0 || row.nights > 0))
})

test('rental report reflects income recorded from a booking', () => {
  const pid = db.getProperties().find((p) => p.name === 'Järvenranta')!.id
  const before = report.rentalIncomeReport(2026).total
  db.addTransaction({
    property_id: pid,
    type: 'income',
    category: 'Vuokraus',
    amount: 500,
    date: '2026-08-15',
    description: 'Testivuokra',
  })
  const after = report.rentalIncomeReport(2026).total
  assert.equal(after, before + 500)
})

test('portfolioReport compares properties side by side for 2026', () => {
  const r = report.portfolioReport(2026)
  assert.equal(r.year, 2026)
  assert.equal(r.rows.length, 3)

  const metsa = r.rows.find((row) => row.name === 'Metsäpirtti')!
  // Siemenaineisto: tulot 650 (Vuokraus), menot 120 (Vesi)
  assert.equal(metsa.income, 650)
  assert.equal(metsa.expense, 120)
  assert.equal(metsa.net, 530)
  assert.ok(
    metsa.roi !== null && Math.abs(metsa.roi - (530 / 120) * 100) < 1e-9,
  )
  // Varaukset: Virtanen 19.-22.6. (3 yötä) + Korhonen 27.7.-3.8. (7 yötä)
  assert.equal(metsa.nights, 10)

  const totalIncome = r.rows.reduce((s, row) => s + row.income, 0)
  const totalExpense = r.rows.reduce((s, row) => s + row.expense, 0)
  assert.equal(r.totals.income, totalIncome)
  assert.equal(r.totals.expense, totalExpense)
  assert.equal(r.totals.net, totalIncome - totalExpense)
})

test('portfolioReport occupancyRate reflects booking nights over days in year', () => {
  const r = report.portfolioReport(2026)
  const metsa = r.rows.find((row) => row.name === 'Metsäpirtti')!
  // 2026 ei ole karkausvuosi -> 365 päivää
  assert.ok(Math.abs(metsa.occupancyRate - (10 / 365) * 100) < 1e-9)
  assert.ok(
    Math.abs(r.totals.occupancyRate - (r.totals.nights / (3 * 365)) * 100) <
      1e-9,
  )
})

test('portfolioReport roi is null when a property has no expenses', () => {
  db.addProperty({
    name: 'Testitontti',
    kiinteistotunnus: '000-000-0-00',
    water_source: 'mains',
    build_year: 2020,
    location: 'Testikylä',
    sauna_type: 'none',
    sauna_info: '',
    property_tax: 0,
    road_fee: 0,
    electricity_fuse: '',
    water_connection: '',
    waste_provider: '',
    waste_bin: '',
    waste_interval: '',
    biowaste: 'collection',
    compost_registered: 0,
    compost_reg_date: '',
  })
  const testId = db.getProperties().find((p) => p.name === 'Testitontti')!.id
  db.addTransaction({
    property_id: testId,
    type: 'income',
    category: 'Vuokraus',
    amount: 100,
    date: '2026-03-01',
    description: 'Testitulo',
  })
  const r = report.portfolioReport(2026)
  const row = r.rows.find((row) => row.propertyId === testId)!
  assert.equal(row.expense, 0)
  assert.equal(row.roi, null)
})

test('portfolioReport counts overdue vs upcoming open tasks correctly', () => {
  const pid = db.getProperties().find((p) => p.name === 'Pappila')!.id
  const before = report
    .portfolioReport(2026)
    .rows.find((r) => r.propertyId === pid)!

  db.addTask({
    property_id: pid,
    title: 'Testitehtävä (menneisyydessä)',
    status: 'pending',
    priority: 'low',
    due_date: '2000-01-01',
    category: 'Testi',
    cost: 0,
    recurrence: 'none',
    next_due: null,
  })
  db.addTask({
    property_id: pid,
    title: 'Testitehtävä (tulevaisuudessa)',
    status: 'pending',
    priority: 'low',
    due_date: '9999-12-31',
    category: 'Testi',
    cost: 0,
    recurrence: 'none',
    next_due: null,
  })

  const after = report
    .portfolioReport(2026)
    .rows.find((r) => r.propertyId === pid)!
  assert.equal(after.openTasks, before.openTasks + 2)
  assert.equal(after.overdueTasks, before.overdueTasks + 1)
})

test('toCSV escapes commas and quotes', () => {
  const csv = report.toCSV([{ a: 'x,y', b: 'he said "hi"', c: 3 }])
  assert.equal(csv, 'a,b,c\n"x,y","he said ""hi""",3\n')
})

test('buildCsvExports produces expected files with headers', () => {
  const files = report.buildCsvExports()
  assert.ok(
    files['transactions.csv']!.startsWith(
      'id,property_id,type,category,amount',
    ),
  )
  assert.ok(Object.keys(files).includes('properties.csv'))
})
