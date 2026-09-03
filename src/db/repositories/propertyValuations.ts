import { initDb } from '../schema.js'
import type { PropertyValuation } from '../types.js'

export function getPropertyValuations(
  propertyId?: number,
): PropertyValuation[] {
  const db = initDb()
  // Nousevaan päiväysjärjestykseen, jotta arvonmuutos ensimmäisestä viimeisimpään on helppo laskea.
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM property_valuations WHERE property_id = ? ORDER BY valuation_date ASC',
      )
    : db.prepare(
        'SELECT * FROM property_valuations ORDER BY property_id ASC, valuation_date ASC',
      )
  return (
    propertyId ? query.all(propertyId) : query.all()
  ) as PropertyValuation[]
}

export function addPropertyValuation(v: Omit<PropertyValuation, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO property_valuations (property_id, value, valuation_date, source, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(v.property_id, v.value, v.valuation_date, v.source, v.notes)
}

export function updatePropertyValuation(v: PropertyValuation): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE property_valuations
    SET property_id = ?, value = ?, valuation_date = ?, source = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(v.property_id, v.value, v.valuation_date, v.source, v.notes, v.id)
}
