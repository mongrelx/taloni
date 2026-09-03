import { initDb } from '../schema.js'
import type { DeletableTable } from '../types.js'

export function deleteRow(table: DeletableTable, id: number): void {
  const db = initDb()
  const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
  stmt.run(id)
}
