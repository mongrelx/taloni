import { initDb } from '../schema.js'
import type { Utility } from '../types.js'

export function getUtilities(propertyId?: number): Utility[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM utilities WHERE property_id = ? ORDER BY billing_month DESC, type ASC',
      )
    : db.prepare(
        'SELECT * FROM utilities ORDER BY billing_month DESC, property_id ASC, type ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Utility[]
}

export function addUtility(u: Omit<Utility, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO utilities (property_id, type, amount, billing_date, billing_month, usage_value, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    u.property_id,
    u.type,
    u.amount,
    u.billing_date,
    u.billing_month,
    u.usage_value,
    u.provider,
  )
}

export function updateUtility(u: Utility): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE utilities
    SET property_id = ?, type = ?, amount = ?, billing_date = ?, billing_month = ?, usage_value = ?, provider = ?
    WHERE id = ?
  `)
  stmt.run(
    u.property_id,
    u.type,
    u.amount,
    u.billing_date,
    u.billing_month,
    u.usage_value,
    u.provider,
    u.id,
  )
}
