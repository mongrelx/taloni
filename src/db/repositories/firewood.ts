import { initDb } from '../schema.js'
import type { Firewood } from '../types.js'

export function getFirewood(propertyId?: number): Firewood[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM firewood WHERE property_id = ? ORDER BY drying_status ASC, wood_type ASC',
      )
    : db.prepare(
        'SELECT * FROM firewood ORDER BY property_id ASC, drying_status ASC, wood_type ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Firewood[]
}

export function addFirewood(f: Omit<Firewood, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO firewood (property_id, wood_type, volume, unit, location, drying_status, stacked_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    f.property_id,
    f.wood_type,
    f.volume,
    f.unit,
    f.location,
    f.drying_status,
    f.stacked_date,
    f.notes,
  )
}

export function updateFirewood(f: Firewood): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE firewood
    SET property_id = ?, wood_type = ?, volume = ?, unit = ?, location = ?, drying_status = ?, stacked_date = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    f.property_id,
    f.wood_type,
    f.volume,
    f.unit,
    f.location,
    f.drying_status,
    f.stacked_date,
    f.notes,
    f.id,
  )
}
