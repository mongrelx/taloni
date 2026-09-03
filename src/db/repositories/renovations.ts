import { initDb } from '../schema.js'
import type { Renovation } from '../types.js'

export function getRenovations(propertyId?: number): Renovation[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM renovations WHERE property_id = ? ORDER BY status DESC, start_date DESC',
      )
    : db.prepare(
        'SELECT * FROM renovations ORDER BY status DESC, start_date DESC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Renovation[]
}

export function addRenovation(ren: Omit<Renovation, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO renovations (property_id, project_name, status, budget, spent, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    ren.property_id,
    ren.project_name,
    ren.status,
    ren.budget,
    ren.spent,
    ren.start_date,
    ren.end_date,
  )
}

export function updateRenovation(ren: Renovation): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE renovations
    SET property_id = ?, project_name = ?, status = ?, budget = ?, spent = ?, start_date = ?, end_date = ?
    WHERE id = ?
  `)
  stmt.run(
    ren.property_id,
    ren.project_name,
    ren.status,
    ren.budget,
    ren.spent,
    ren.start_date,
    ren.end_date,
    ren.id,
  )
}
