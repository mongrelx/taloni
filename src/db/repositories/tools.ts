import { initDb } from '../schema.js'
import type { Tool } from '../types.js'

export function getTools(): Tool[] {
  const db = initDb()
  const stmt = db.prepare('SELECT * FROM tools ORDER BY status DESC, name ASC')
  return stmt.all() as Tool[]
}

export function addTool(t: Omit<Tool, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO tools (name, status, location, purchase_date)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(t.name, t.status, t.location, t.purchase_date)
}

export function updateTool(t: Tool): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE tools
    SET name = ?, status = ?, location = ?, purchase_date = ?
    WHERE id = ?
  `)
  stmt.run(t.name, t.status, t.location, t.purchase_date, t.id)
}
