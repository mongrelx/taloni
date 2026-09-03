import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { before, test } from 'node:test'

// Eristetään tietokanta väliaikaishakemistoon ennen db-moduulin latausta.
process.env.HOME = mkdtempSync(join(tmpdir(), 'taloni-db-'))

let db: typeof import('../src/db/index.ts')

before(async () => {
  db = await import('../src/db/index.ts')
  db.initDb()
})

test('seed creates three Finnish log houses', () => {
  const props = db.getProperties()
  assert.equal(props.length, 3)
  assert.ok(
    props.some((p) => p.name === 'Metsäpirtti' && p.water_source === 'well'),
  )
})

test('advanceRecurrence computes the next due date', () => {
  assert.equal(db.advanceRecurrence('2027-05-10', 'yearly'), '2028-05-10')
  assert.equal(
    db.advanceRecurrence('2026-06-15', 'every_3_years'),
    '2029-06-15',
  )
  assert.equal(db.advanceRecurrence('2026-01-31', 'monthly'), '2026-02-28') // kk-ylivuoto normalisoituu
  assert.equal(db.advanceRecurrence('2026-01-01', 'none'), '2026-01-01')
})

test('bookingNights counts nights', () => {
  assert.equal(
    db.bookingNights({ start_date: '2026-06-19', end_date: '2026-06-22' }),
    3,
  )
  assert.equal(db.bookingNights({ start_date: 'x', end_date: 'y' }), 0)
})

test('completing a recurring task spawns the next occurrence', () => {
  const pid = db.getProperties()[0]!.id
  db.addTask({
    property_id: pid,
    title: 'Toistuva nuohous',
    status: 'pending',
    priority: 'high',
    due_date: '2026-08-01',
    category: 'Nuohous',
    cost: 65,
    recurrence: 'yearly',
    next_due: db.advanceRecurrence('2026-08-01', 'yearly'),
  })
  const before = db.getTasks(pid).filter((t) => t.title === 'Toistuva nuohous')
  assert.equal(before.length, 1)
  db.updateTaskStatus(before[0]!.id, 'completed')
  const after = db.getTasks(pid).filter((t) => t.title === 'Toistuva nuohous')
  assert.equal(after.length, 2) // alkuperäinen valmis + uusi pending
  assert.ok(
    after.some((t) => t.status === 'pending' && t.due_date === '2027-08-01'),
  )
})

test('firewood CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addFirewood({
    property_id: pid,
    wood_type: 'Koivu',
    volume: 5,
    unit: 'pino-m³',
    location: 'liiteri',
    drying_status: 'ready',
    stacked_date: '2026-05-01',
    notes: '',
  })
  const fw = db
    .getFirewood(pid)
    .find((f) => f.wood_type === 'Koivu' && f.volume === 5)
  assert.ok(fw)
  db.updateFirewood({ ...fw!, volume: 7 })
  assert.equal(db.getFirewood(pid).find((f) => f.id === fw!.id)!.volume, 7)
  db.deleteRow('firewood', fw!.id)
  assert.equal(
    db.getFirewood(pid).some((f) => f.id === fw!.id),
    false,
  )
})

test('assessWastewater flags an old septic tank and grades by area', () => {
  const base = {
    id: 1,
    property_id: 1,
    permit_info: '',
    last_emptied: null,
    next_emptied: null,
    emptying_provider: '',
    has_wc: 1 as const,
    exemption: 0 as const,
  }
  // Saostuskaivo, ei herkkä alue → warning (ei kiinteää takarajaa)
  const nonSensitive = db.assessWastewater({
    ...base,
    type: 'septic_tank',
    build_year: 1973,
    shoreline: 0,
    groundwater: 0,
  })
  assert.equal(nonSensitive.level, 'warning')
  assert.ok(nonSensitive.issues.some((i) => i.includes('saostuskaivo')))
  // Sama järjestelmä ranta-alueella → action (2019 takaraja ohitettu)
  const sensitive = db.assessWastewater({
    ...base,
    type: 'septic_tank',
    build_year: 1973,
    shoreline: 1,
    groundwater: 0,
  })
  assert.equal(sensitive.level, 'action')
  assert.ok(sensitive.actions.some((a) => a.includes('2019')))
  // Vapautus keventää herkälläkin alueella
  const exempt = db.assessWastewater({
    ...base,
    type: 'septic_tank',
    build_year: 1973,
    shoreline: 1,
    groundwater: 0,
    exemption: 1,
  })
  assert.equal(exempt.level, 'warning')
  // Kunnan viemäri → ok
  assert.equal(
    db.assessWastewater({
      ...base,
      type: 'mains_sewer',
      build_year: 2010,
      shoreline: 0,
      groundwater: 0,
    }).level,
    'ok',
  )
  // Umpisäiliö → ok
  assert.equal(
    db.assessWastewater({
      ...base,
      type: 'sealed_tank',
      build_year: 2016,
      shoreline: 1,
      groundwater: 0,
    }).level,
    'ok',
  )
})

test('assessComposting flags unregistered home composting', () => {
  const base = db.getProperties()[0]!
  assert.equal(db.assessComposting({ ...base, biowaste: 'collection' }), null)
  const warn = db.assessComposting({
    ...base,
    biowaste: 'home_compost',
    compost_registered: 0,
  })
  assert.equal(warn?.level, 'warning')
  const ok = db.assessComposting({
    ...base,
    biowaste: 'home_compost',
    compost_registered: 1,
    compost_reg_date: '2026-03-01',
  })
  assert.equal(ok?.level, 'ok')
})

test('property connection & waste fields round-trip', () => {
  db.addProperty({
    name: 'Liittymätesti',
    kiinteistotunnus: '9-9-9-9',
    water_source: 'mains',
    build_year: 2001,
    location: 'X',
    sauna_type: 'none',
    sauna_info: '',
    property_tax: 0,
    road_fee: 0,
    electricity_fuse: '3×25 A',
    water_connection: 'DN32',
    waste_provider: 'Kiertokaari',
    waste_bin: '240 l',
    waste_interval: '4 vk',
    biowaste: 'home_compost',
    compost_registered: 0,
    compost_reg_date: '',
  })
  const p = db.getProperties().find((x) => x.name === 'Liittymätesti')!
  assert.equal(p.electricity_fuse, '3×25 A')
  assert.equal(p.biowaste, 'home_compost')
  db.updateProperty({
    ...p,
    compost_registered: 1,
    compost_reg_date: '2026-05-01',
  })
  const p2 = db.getProperties().find((x) => x.id === p.id)!
  assert.equal(p2.compost_registered, 1)
  assert.equal(p2.compost_reg_date, '2026-05-01')
})

test('documents can be linked to a fireplace (nuohoustodistus) and queried', () => {
  const pid = db.getProperties().find((p) => p.name === 'Metsäpirtti')!.id
  const fp = db.getFireplaces(pid)[0]!
  const before = db.getDocumentsFor('fireplace', fp.id).length
  db.addDocument({
    property_id: pid,
    doc_type: 'inspection',
    title: 'Nuohoustodistus testi',
    file_path: '~/x.pdf',
    issued_date: '2026-05-10',
    notes: '',
    linked_type: 'fireplace',
    linked_id: fp.id,
  })
  const after = db.getDocumentsFor('fireplace', fp.id)
  assert.equal(after.length, before + 1)
  assert.ok(
    after.some(
      (d) => d.title === 'Nuohoustodistus testi' && d.linked_id === fp.id,
    ),
  )
  // Ei-linkitetyt eivät osu hakuun
  db.addDocument({
    property_id: pid,
    doc_type: 'other',
    title: 'Irrallinen',
    file_path: '',
    issued_date: '',
    notes: '',
    linked_type: '',
    linked_id: 0,
  })
  assert.equal(db.getDocumentsFor('fireplace', fp.id).length, after.length)
})

test('deleting a property cascades to its tasks', () => {
  db.addProperty({
    name: 'Poistettava',
    kiinteistotunnus: '1-2-3-4',
    water_source: 'well',
    build_year: 2000,
    location: 'X',
    sauna_type: 'none',
    sauna_info: '',
    property_tax: 0,
    road_fee: 0,
  })
  const p = db.getProperties().find((x) => x.name === 'Poistettava')!
  db.addTask({
    property_id: p.id,
    title: 'Katoava',
    status: 'pending',
    priority: 'low',
    due_date: '2026-01-01',
    category: 'X',
    cost: 0,
    recurrence: 'none',
    next_due: null,
  })
  assert.equal(db.getTasks(p.id).length, 1)
  db.deleteProperty(p.id)
  assert.equal(db.getTasks(p.id).length, 0)
})

test('transactions can be linked to a renovation and cascade to null on delete', () => {
  const p = db.getProperties()[0]!
  db.addRenovation({
    property_id: p.id,
    project_name: 'Testiremontti',
    status: 'in_progress',
    budget: 1000,
    spent: 0,
    start_date: '2026-01-01',
    end_date: null,
  })
  const ren = db
    .getRenovations(p.id)
    .find((r) => r.project_name === 'Testiremontti')!

  db.addTransaction({
    property_id: p.id,
    type: 'expense',
    category: 'Remontti',
    amount: 250,
    date: '2026-01-15',
    description: 'Linkitetty kulu',
    renovation_id: ren.id,
  })
  const linked = db.getTransactionsForRenovation(ren.id)
  assert.equal(linked.length, 1)
  assert.equal(linked[0]!.amount, 250)

  db.deleteRow('renovations', ren.id)
  const afterDelete = db
    .getTransactions(p.id)
    .find((t) => t.description === 'Linkitetty kulu')!
  assert.equal(afterDelete.renovation_id, null)
})

test('advanceRecurrence edge cases: quarterly, leap years, month clamping', () => {
  // quarterly
  assert.equal(db.advanceRecurrence('2026-01-15', 'quarterly'), '2026-04-15')
  assert.equal(db.advanceRecurrence('2026-11-20', 'quarterly'), '2027-02-20')
  // Leap day to non-leap year (clamp to Feb 28)
  assert.equal(db.advanceRecurrence('2024-02-29', 'yearly'), '2025-02-28')
  assert.equal(
    db.advanceRecurrence('2024-02-29', 'every_3_years'),
    '2027-02-28',
  )
  // Month-end clamping (March 31 + 1 month -> April 30)
  assert.equal(db.advanceRecurrence('2026-03-31', 'monthly'), '2026-04-30')
  assert.equal(db.advanceRecurrence('2026-05-31', 'monthly'), '2026-06-30')
  assert.equal(db.advanceRecurrence('2026-08-31', 'monthly'), '2026-09-30')
})

test('assessWastewater handles small treatment, post-2004 soil filters, groundwater, and lack of WC', () => {
  const base = {
    id: 1,
    property_id: 1,
    permit_info: '',
    last_emptied: null,
    next_emptied: null,
    emptying_provider: '',
    has_wc: 1 as const,
    exemption: 0 as const,
  }

  // Small treatment plant -> OK
  const smallTreatment = db.assessWastewater({
    ...base,
    type: 'small_treatment',
    build_year: 2020,
    shoreline: 0,
    groundwater: 0,
  })
  assert.equal(smallTreatment.level, 'ok')
  assert.ok(smallTreatment.headline.includes('Pienpuhdistamo'))

  // Post-2004 soil filter -> OK
  const modernSoil = db.assessWastewater({
    ...base,
    type: 'soil_filter',
    build_year: 2012,
    shoreline: 0,
    groundwater: 0,
  })
  assert.equal(modernSoil.level, 'ok')

  // Pre-2004 soil filter on groundwater -> action
  const oldSoilGroundwater = db.assessWastewater({
    ...base,
    type: 'soil_filter',
    build_year: 1998,
    shoreline: 0,
    groundwater: 1,
  })
  assert.equal(oldSoilGroundwater.level, 'action')
  assert.ok(oldSoilGroundwater.actions.some((a) => a.includes('pohjavesialue')))

  // Septic tank with both shoreline and groundwater
  const bothSensitive = db.assessWastewater({
    ...base,
    type: 'septic_tank',
    build_year: 1990,
    shoreline: 1,
    groundwater: 1,
  })
  assert.equal(bothSensitive.level, 'action')
  assert.ok(
    bothSensitive.actions.some((a) => a.includes('ranta- ja pohjavesialue')),
  )

  // Old septic tank without WC -> warning (vähäiset jätevedet)
  const noWc = db.assessWastewater({
    ...base,
    type: 'septic_tank',
    build_year: 1980,
    shoreline: 1,
    groundwater: 0,
    has_wc: 0,
  })
  assert.equal(noWc.level, 'warning')
  assert.ok(noWc.headline.includes('Vähäiset jätevedet'))
})

test('assessComposting handles shared and none biowaste types', () => {
  const base = db.getProperties()[0]!
  assert.equal(db.assessComposting({ ...base, biowaste: 'shared' }), null)
  assert.equal(db.assessComposting({ ...base, biowaste: 'none' }), null)
})

test('meter readings CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addMeterReading({
    property_id: pid,
    meter_type: 'electric',
    reading: 14500.5,
    reading_date: '2026-06-01',
    notes: 'Päämittari',
  })
  const readings = db.getMeterReadings(pid)
  const reading = readings.find((r) => r.reading === 14500.5)
  assert.ok(reading)
  assert.equal(reading?.meter_type, 'electric')

  db.updateMeterReading({
    ...reading!,
    reading: 14600.0,
  })
  const updated = db.getMeterReadings(pid).find((r) => r.id === reading!.id)
  assert.equal(updated?.reading, 14600.0)

  db.deleteRow('meter_readings', reading!.id)
  assert.equal(
    db.getMeterReadings(pid).some((r) => r.id === reading!.id),
    false,
  )
})

test('water tests CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addWaterTest({
    property_id: pid,
    test_date: '2026-05-15',
    ecoli: '0 pmy/100ml',
    coliforms: '0 pmy/100ml',
    nitrate: '< 1 mg/l',
    ph: '6.8',
    iron: '0.1 mg/l',
    fluoride: '< 0.1 mg/l',
    passed: 1,
    notes: 'Puhdas kaivovesi',
  })
  const tests = db.getWaterTests(pid)
  const testEntry = tests.find((t) => t.test_date === '2026-05-15')
  assert.ok(testEntry)
  assert.equal(testEntry?.passed, 1)

  db.updateWaterTest({
    ...testEntry!,
    notes: 'Päivitetty huomio',
  })
  const updated = db.getWaterTests(pid).find((t) => t.id === testEntry!.id)
  assert.equal(updated?.notes, 'Päivitetty huomio')

  db.deleteRow('water_tests', testEntry!.id)
  assert.equal(
    db.getWaterTests(pid).some((t) => t.id === testEntry!.id),
    false,
  )
})

test('heating systems and contacts CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addHeatingSystem({
    property_id: pid,
    type: 'geothermal',
    description: 'Nibe F1255',
    last_inspection: '2025-09-01',
    next_inspection: '2027-09-01',
  })
  const heatings = db.getHeatingSystems(pid)
  const heat = heatings.find((h) => h.description === 'Nibe F1255')
  assert.ok(heat)
  assert.equal(heat?.type, 'geothermal')

  db.updateHeatingSystem({
    ...heat!,
    description: 'Nibe F1255-6',
  })
  const updatedHeat = db.getHeatingSystems(pid).find((h) => h.id === heat!.id)
  assert.equal(updatedHeat?.description, 'Nibe F1255-6')
  db.deleteRow('heating_systems', heat!.id)

  // Contacts
  db.addContact({
    name: 'Matti Nuohooja',
    role: 'nuohooja',
    phone: '040-1234567',
    email: 'matti@nuohous.fi',
    notes: 'Käy vuosittain',
  })
  const contacts = db.getContacts()
  const contact = contacts.find((c) => c.name === 'Matti Nuohooja')
  assert.ok(contact)
  assert.equal(contact?.role, 'nuohooja')

  db.updateContact({
    ...contact!,
    phone: '040-7654321',
  })
  const updatedContact = db.getContacts().find((c) => c.id === contact!.id)
  assert.equal(updatedContact?.phone, '040-7654321')
  db.deleteRow('contacts', contact!.id)
})

test('building materials CRUD round-trip', () => {
  const pid = db.getProperties()[0]!.id
  db.addBuildingMaterial({
    property_id: pid,
    category: 'paint',
    location: 'Sauna',
    material: 'Saunasuoja',
    manufacturer: 'Tikkurila',
    color_code: 'Supi Musta',
    applied_date: '2026-06-01',
    notes: '2 kerrosta',
  })
  const materials = db.getBuildingMaterials(pid)
  const mat = materials.find((m) => m.material === 'Saunasuoja')
  assert.ok(mat)
  assert.equal(mat?.manufacturer, 'Tikkurila')

  db.updateBuildingMaterial({
    ...mat!,
    notes: '3 kerrosta',
  })
  const updated = db.getBuildingMaterials(pid).find((m) => m.id === mat!.id)
  assert.equal(updated?.notes, '3 kerrosta')

  db.deleteRow('building_materials', mat!.id)
  assert.equal(
    db.getBuildingMaterials(pid).some((m) => m.id === mat!.id),
    false,
  )
})
