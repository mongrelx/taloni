import { initDb } from '../schema.js'
import type { Booking } from '../types.js'

export function getBookings(propertyId?: number): Booking[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM bookings WHERE property_id = ? ORDER BY start_date ASC',
      )
    : db.prepare('SELECT * FROM bookings ORDER BY start_date ASC')
  return (propertyId ? query.all(propertyId) : query.all()) as Booking[]
}

export function addBooking(b: Omit<Booking, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO bookings (property_id, guest_name, start_date, end_date, price, status, income_recorded, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    b.property_id,
    b.guest_name,
    b.start_date,
    b.end_date,
    b.price,
    b.status,
    b.income_recorded,
    b.notes,
  )
}

export function updateBooking(b: Booking): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE bookings
    SET property_id = ?, guest_name = ?, start_date = ?, end_date = ?, price = ?, status = ?, income_recorded = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    b.property_id,
    b.guest_name,
    b.start_date,
    b.end_date,
    b.price,
    b.status,
    b.income_recorded,
    b.notes,
    b.id,
  )
}

// Laskee öiden lukumäärän varauksessa (lähtö − saapuminen).
export function bookingNights(
  b: Pick<Booking, 'start_date' | 'end_date'>,
): number {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(b.start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.end_date)
  )
    return 0
  const ms =
    new Date(`${b.end_date}T00:00:00Z`).getTime() -
    new Date(`${b.start_date}T00:00:00Z`).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}
