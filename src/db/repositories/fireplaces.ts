import { initDb } from '../schema.js'
import type { Fireplace } from '../types.js'

export function getFireplaces(propertyId?: number): Fireplace[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM fireplaces WHERE property_id = ? ORDER BY next_sweep ASC',
      )
    : db.prepare(
        'SELECT * FROM fireplaces ORDER BY property_id ASC, next_sweep ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Fireplace[]
}

export function addFireplace(f: Omit<Fireplace, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO fireplaces (property_id, type, name, last_sweep, next_sweep, sweeper)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    f.property_id,
    f.type,
    f.name,
    f.last_sweep ?? null,
    f.next_sweep ?? null,
    f.sweeper,
  )
}

export function updateFireplace(f: Fireplace): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE fireplaces
    SET property_id = ?, type = ?, name = ?, last_sweep = ?, next_sweep = ?, sweeper = ?
    WHERE id = ?
  `)
  stmt.run(
    f.property_id,
    f.type,
    f.name,
    f.last_sweep ?? null,
    f.next_sweep ?? null,
    f.sweeper,
    f.id,
  )
}
