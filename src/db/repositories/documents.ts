import { initDb } from '../schema.js'
import type { Document, DocumentLinkType } from '../types.js'

export function getDocuments(propertyId?: number): Document[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM documents WHERE property_id = ? ORDER BY issued_date DESC',
      )
    : db.prepare(
        'SELECT * FROM documents ORDER BY property_id ASC, issued_date DESC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Document[]
}

export function addDocument(d: Omit<Document, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO documents (property_id, doc_type, title, file_path, issued_date, notes, linked_type, linked_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    d.property_id,
    d.doc_type,
    d.title,
    d.file_path,
    d.issued_date,
    d.notes,
    d.linked_type ?? '',
    d.linked_id ?? 0,
  )
}

export function updateDocument(d: Document): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE documents
    SET property_id = ?, doc_type = ?, title = ?, file_path = ?, issued_date = ?, notes = ?, linked_type = ?, linked_id = ?
    WHERE id = ?
  `)
  stmt.run(
    d.property_id,
    d.doc_type,
    d.title,
    d.file_path,
    d.issued_date,
    d.notes,
    d.linked_type ?? '',
    d.linked_id ?? 0,
    d.id,
  )
}

// Palauttaa tiettyyn tietueeseen linkitetyt asiakirjat (esim. tulisijan nuohoustodistukset).
export function getDocumentsFor(
  linkedType: DocumentLinkType,
  linkedId: number,
): Document[] {
  const db = initDb()
  return db
    .prepare(
      'SELECT * FROM documents WHERE linked_type = ? AND linked_id = ? ORDER BY issued_date DESC',
    )
    .all(linkedType, linkedId) as Document[]
}
