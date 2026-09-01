import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { before, test } from 'node:test'

process.env.HOME = mkdtempSync(join(tmpdir(), 'taloni-report-'))

let db: typeof import('../src/db.ts')
let report: typeof import('../src/report.ts')

before(async () => {
  db = await import('../src/db.ts')
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
