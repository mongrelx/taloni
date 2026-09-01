import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Eristetään tietokanta väliaikaishakemistoon ennen db-moduulin latausta.
process.env.HOME = mkdtempSync(join(tmpdir(), 'taloni-db-'))

let db: typeof import('../src/db.ts')

before(async () => {
  db = await import('../src/db.ts')
  db.initDb()
})

test('seed creates three Finnish log houses', () => {
  const props = db.getProperties()
  assert.equal(props.length, 3)
  assert.ok(props.some(p => p.name === 'Metsäpirtti' && p.water_source === 'well'))
})

test('advanceRecurrence computes the next due date', () => {
  assert.equal(db.advanceRecurrence('2027-05-10', 'yearly'), '2028-05-10')
  assert.equal(db.advanceRecurrence('2026-06-15', 'every_3_years'), '2029-06-15')
  assert.equal(db.advanceRecurrence('2026-01-31', 'monthly'), '2026-02-28') // kk-ylivuoto normalisoituu
  assert.equal(db.advanceRecurrence('2026-01-01', 'none'), '2026-01-01')
})

test('bookingNights counts nights', () => {
  assert.equal(db.bookingNights({ start_date: '2026-06-19', end_date: '2026-06-22' }), 3)
  assert.equal(db.bookingNights({ start_date: 'x', end_date: 'y' }), 0)
})

test('completing a recurring task spawns the next occurrence', () => {
  const pid = db.getProperties()[0]!.id
  db.addTask({
    property_id: pid, title: 'Toistuva nuohous', status: 'pending', priority: 'high',
    due_date: '2026-08-01', category: 'Nuohous', cost: 65, recurrence: 'yearly',
    next_due: db.advanceRecurrence('2026-08-01', 'yearly')
  })
  const before = db.getTasks(pid).filter(t => t.title === 'Toistuva nuohous')
  assert.equal(before.length, 1)
  db.updateTaskStatus(before[0]!.id, 'completed')
  const after = db.getTasks(pid).filter(t => t.title === 'Toistuva nuohous')
  assert.equal(after.length, 2) // alkuperäinen valmis + uusi pending
  assert.ok(after.some(t => t.status === 'pending' && t.due_date === '2027-08-01'))
})

test('firewood CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addFirewood({ property_id: pid, wood_type: 'Koivu', volume: 5, unit: 'pino-m³', location: 'liiteri', drying_status: 'ready', stacked_date: '2026-05-01', notes: '' })
  const fw = db.getFirewood(pid).find(f => f.wood_type === 'Koivu' && f.volume === 5)
  assert.ok(fw)
  db.updateFirewood({ ...fw!, volume: 7 })
  assert.equal(db.getFirewood(pid).find(f => f.id === fw!.id)!.volume, 7)
  db.deleteRow('firewood', fw!.id)
  assert.equal(db.getFirewood(pid).some(f => f.id === fw!.id), false)
})

test('assessWastewater flags an old septic tank and grades by area', () => {
  const base = { id: 1, property_id: 1, permit_info: '', last_emptied: null, next_emptied: null, emptying_provider: '', has_wc: 1 as const, exemption: 0 as const }
  // Saostuskaivo, ei herkkä alue → warning (ei kiinteää takarajaa)
  const nonSensitive = db.assessWastewater({ ...base, type: 'septic_tank', build_year: 1973, shoreline: 0, groundwater: 0 })
  assert.equal(nonSensitive.level, 'warning')
  assert.ok(nonSensitive.issues.some(i => i.includes('saostuskaivo')))
  // Sama järjestelmä ranta-alueella → action (2019 takaraja ohitettu)
  const sensitive = db.assessWastewater({ ...base, type: 'septic_tank', build_year: 1973, shoreline: 1, groundwater: 0 })
  assert.equal(sensitive.level, 'action')
  assert.ok(sensitive.actions.some(a => a.includes('2019')))
  // Vapautus keventää herkälläkin alueella
  const exempt = db.assessWastewater({ ...base, type: 'septic_tank', build_year: 1973, shoreline: 1, groundwater: 0, exemption: 1 })
  assert.equal(exempt.level, 'warning')
  // Kunnan viemäri → ok
  assert.equal(db.assessWastewater({ ...base, type: 'mains_sewer', build_year: 2010, shoreline: 0, groundwater: 0 }).level, 'ok')
  // Umpisäiliö → ok
  assert.equal(db.assessWastewater({ ...base, type: 'sealed_tank', build_year: 2016, shoreline: 1, groundwater: 0 }).level, 'ok')
})

test('assessComposting flags unregistered home composting', () => {
  const base = db.getProperties()[0]!
  assert.equal(db.assessComposting({ ...base, biowaste: 'collection' }), null)
  const warn = db.assessComposting({ ...base, biowaste: 'home_compost', compost_registered: 0 })
  assert.equal(warn?.level, 'warning')
  const ok = db.assessComposting({ ...base, biowaste: 'home_compost', compost_registered: 1, compost_reg_date: '2026-03-01' })
  assert.equal(ok?.level, 'ok')
})

test('property connection & waste fields round-trip', () => {
  db.addProperty({ name: 'Liittymätesti', kiinteistotunnus: '9-9-9-9', water_source: 'mains', build_year: 2001, location: 'X', sauna_type: 'none', sauna_info: '', property_tax: 0, road_fee: 0, electricity_fuse: '3×25 A', water_connection: 'DN32', waste_provider: 'Kiertokaari', waste_bin: '240 l', waste_interval: '4 vk', biowaste: 'home_compost', compost_registered: 0, compost_reg_date: '' })
  const p = db.getProperties().find(x => x.name === 'Liittymätesti')!
  assert.equal(p.electricity_fuse, '3×25 A')
  assert.equal(p.biowaste, 'home_compost')
  db.updateProperty({ ...p, compost_registered: 1, compost_reg_date: '2026-05-01' })
  const p2 = db.getProperties().find(x => x.id === p.id)!
  assert.equal(p2.compost_registered, 1)
  assert.equal(p2.compost_reg_date, '2026-05-01')
})

test('documents can be linked to a fireplace (nuohoustodistus) and queried', () => {
  const pid = db.getProperties().find(p => p.name === 'Metsäpirtti')!.id
  const fp = db.getFireplaces(pid)[0]!
  const before = db.getDocumentsFor('fireplace', fp.id).length
  db.addDocument({ property_id: pid, doc_type: 'inspection', title: 'Nuohoustodistus testi', file_path: '~/x.pdf', issued_date: '2026-05-10', notes: '', linked_type: 'fireplace', linked_id: fp.id })
  const after = db.getDocumentsFor('fireplace', fp.id)
  assert.equal(after.length, before + 1)
  assert.ok(after.some(d => d.title === 'Nuohoustodistus testi' && d.linked_id === fp.id))
  // Ei-linkitetyt eivät osu hakuun
  db.addDocument({ property_id: pid, doc_type: 'other', title: 'Irrallinen', file_path: '', issued_date: '', notes: '', linked_type: '', linked_id: 0 })
  assert.equal(db.getDocumentsFor('fireplace', fp.id).length, after.length)
})

test('deleting a property cascades to its tasks', () => {
  db.addProperty({ name: 'Poistettava', kiinteistotunnus: '1-2-3-4', water_source: 'well', build_year: 2000, location: 'X', sauna_type: 'none', sauna_info: '', property_tax: 0, road_fee: 0 })
  const p = db.getProperties().find(x => x.name === 'Poistettava')!
  db.addTask({ property_id: p.id, title: 'Katoava', status: 'pending', priority: 'low', due_date: '2026-01-01', category: 'X', cost: 0, recurrence: 'none', next_due: null })
  assert.equal(db.getTasks(p.id).length, 1)
  db.deleteProperty(p.id)
  assert.equal(db.getTasks(p.id).length, 0)
})
