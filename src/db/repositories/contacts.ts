import { initDb } from '../schema.js'
import type { Contact } from '../types.js'

export function getContacts(): Contact[] {
  const db = initDb()
  // Yhteystiedot ovat globaaleja (eivät kohdekohtaisia) — palveluntarjoajat palvelevat kaikkia kiinteistöjä.
  return db
    .prepare('SELECT * FROM contacts ORDER BY role ASC, name ASC')
    .all() as Contact[]
}

export function addContact(c: Omit<Contact, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(
    'INSERT INTO contacts (name, role, phone, email, notes) VALUES (?, ?, ?, ?, ?)',
  )
  stmt.run(c.name, c.role, c.phone, c.email, c.notes)
}

export function updateContact(c: Contact): void {
  const db = initDb()
  const stmt = db.prepare(
    'UPDATE contacts SET name = ?, role = ?, phone = ?, email = ?, notes = ? WHERE id = ?',
  )
  stmt.run(c.name, c.role, c.phone, c.email, c.notes, c.id)
}
