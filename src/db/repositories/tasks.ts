import { initDb } from '../schema.js'
import type { Recurrence, Task } from '../types.js'

export function getTasks(propertyId?: number): Task[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM tasks WHERE property_id = ? ORDER BY status ASC, due_date ASC',
      )
    : db.prepare('SELECT * FROM tasks ORDER BY status ASC, due_date ASC')
  return (propertyId ? query.all(propertyId) : query.all()) as Task[]
}

export function addTask(task: Omit<Task, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO tasks (property_id, title, status, priority, due_date, category, cost, recurrence, next_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    task.property_id,
    task.title,
    task.status,
    task.priority,
    task.due_date,
    task.category,
    task.cost,
    task.recurrence ?? 'none',
    task.next_due ?? null,
  )
}

// Laskee toistuvan tehtävän seuraavan eräpäivän annetusta päivämäärästä.
// Palauttaa ISO-muotoisen YYYY-MM-DD-merkkijonon. Kuukauden loppu rajataan (clamp)
// niin ettei esim. 31.1. + 1 kk valu maaliskuulle vaan asettuu 28.2.
export function advanceRecurrence(
  dateStr: string,
  recurrence: Recurrence,
): string {
  if (recurrence === 'none') return dateStr
  const months =
    recurrence === 'monthly'
      ? 1
      : recurrence === 'quarterly'
        ? 3
        : recurrence === 'yearly'
          ? 12
          : 36 // every_3_years
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate() // kuukauden nm viimeinen päivä
  const nd = Math.min(d, lastDay)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${ny}-${pad(nm)}-${pad(nd)}`
}

export function updateTaskStatus(id: number, status: Task['status']): void {
  const db = initDb()
  const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?')
  stmt.run(status, id)

  // Toistuvuusmoottori: kun toistuva tehtävä merkitään valmiiksi, kirjataan seuraava
  // esiintymä uutena 'pending'-tehtävänä ja siirretään eräpäivät eteenpäin. Näin
  // lakisääteiset velvoitteet (nuohous, sakokaivon tyhjennys, kaivovesi) eivät unohdu.
  if (status !== 'completed') return
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
    | Task
    | undefined
  if (!task || task.recurrence === 'none') return

  const base = task.next_due ?? task.due_date
  const newDueDate = base
  const newNextDue = advanceRecurrence(base, task.recurrence)
  const insertNext = db.prepare(`
    INSERT INTO tasks (property_id, title, status, priority, due_date, category, cost, recurrence, next_due)
    VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `)
  insertNext.run(
    task.property_id,
    task.title,
    task.priority,
    newDueDate,
    task.category,
    task.cost,
    task.recurrence,
    newNextDue,
  )
}

export function updateTask(task: Task): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE tasks
    SET property_id = ?, title = ?, priority = ?, category = ?, cost = ?, recurrence = ?, next_due = ?
    WHERE id = ?
  `)
  stmt.run(
    task.property_id,
    task.title,
    task.priority,
    task.category,
    task.cost,
    task.recurrence ?? 'none',
    task.next_due ?? null,
    task.id,
  )
}
