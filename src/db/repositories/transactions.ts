import { initDb } from '../schema.js'
import type { Transaction } from '../types.js'

export function getTransactions(propertyId?: number): Transaction[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM transactions WHERE property_id = ? ORDER BY date DESC',
      )
    : db.prepare('SELECT * FROM transactions ORDER BY date DESC')
  return (propertyId ? query.all(propertyId) : query.all()) as Transaction[]
}

export function addTransaction(tx: Omit<Transaction, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO transactions (property_id, type, category, amount, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    tx.property_id,
    tx.type,
    tx.category,
    tx.amount,
    tx.date,
    tx.description,
  )
}

export function updateTransaction(tx: Transaction): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE transactions
    SET property_id = ?, type = ?, category = ?, amount = ?, description = ?
    WHERE id = ?
  `)
  stmt.run(
    tx.property_id,
    tx.type,
    tx.category,
    tx.amount,
    tx.description,
    tx.id,
  )
}
