import { initDb } from '../schema.js'
import type { WaterTest } from '../types.js'

export function getWaterTests(propertyId?: number): WaterTest[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM water_tests WHERE property_id = ? ORDER BY test_date DESC',
      )
    : db.prepare('SELECT * FROM water_tests ORDER BY test_date DESC')
  return (propertyId ? query.all(propertyId) : query.all()) as WaterTest[]
}

export function addWaterTest(t: Omit<WaterTest, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO water_tests (property_id, test_date, ecoli, coliforms, nitrate, ph, iron, fluoride, passed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    t.property_id,
    t.test_date,
    t.ecoli,
    t.coliforms,
    t.nitrate,
    t.ph,
    t.iron,
    t.fluoride,
    t.passed,
    t.notes,
  )
}

export function updateWaterTest(t: WaterTest): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE water_tests
    SET property_id = ?, test_date = ?, ecoli = ?, coliforms = ?, nitrate = ?, ph = ?, iron = ?, fluoride = ?, passed = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    t.property_id,
    t.test_date,
    t.ecoli,
    t.coliforms,
    t.nitrate,
    t.ph,
    t.iron,
    t.fluoride,
    t.passed,
    t.notes,
    t.id,
  )
}
