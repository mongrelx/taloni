import { initDb } from '../schema.js'
import type { Insurance } from '../types.js'

export function getInsurance(propertyId?: number): Insurance[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM insurance WHERE property_id = ? ORDER BY renewal_date ASC',
      )
    : db.prepare('SELECT * FROM insurance ORDER BY renewal_date ASC')
  return (propertyId ? query.all(propertyId) : query.all()) as Insurance[]
}

export function addInsurance(i: Omit<Insurance, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO insurance (property_id, policy_name, provider, premium, renewal_date, coverage_details)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    i.property_id,
    i.policy_name,
    i.provider,
    i.premium,
    i.renewal_date,
    i.coverage_details,
  )
}

export function updateInsurance(i: Insurance): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE insurance
    SET property_id = ?, policy_name = ?, provider = ?, premium = ?, renewal_date = ?, coverage_details = ?
    WHERE id = ?
  `)
  stmt.run(
    i.property_id,
    i.policy_name,
    i.provider,
    i.premium,
    i.renewal_date,
    i.coverage_details,
    i.id,
  )
}
