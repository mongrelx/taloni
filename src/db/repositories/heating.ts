import { initDb } from '../schema.js'
import type { HeatingSystem } from '../types.js'

export function getHeatingSystems(propertyId?: number): HeatingSystem[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM heating_systems WHERE property_id = ? ORDER BY next_inspection ASC',
      )
    : db.prepare(
        'SELECT * FROM heating_systems ORDER BY property_id ASC, next_inspection ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as HeatingSystem[]
}

export function addHeatingSystem(h: Omit<HeatingSystem, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO heating_systems (property_id, type, description, last_inspection, next_inspection)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(
    h.property_id,
    h.type,
    h.description,
    h.last_inspection ?? null,
    h.next_inspection ?? null,
  )
}

export function updateHeatingSystem(h: HeatingSystem): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE heating_systems
    SET property_id = ?, type = ?, description = ?, last_inspection = ?, next_inspection = ?
    WHERE id = ?
  `)
  stmt.run(
    h.property_id,
    h.type,
    h.description,
    h.last_inspection ?? null,
    h.next_inspection ?? null,
    h.id,
  )
}
