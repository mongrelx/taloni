import { initDb } from '../schema.js'
import type { MeterReading } from '../types.js'

export function getMeterReadings(propertyId?: number): MeterReading[] {
  const db = initDb()
  // Nousevaan päiväysjärjestykseen, jotta kulutustrendi (peräkkäisten lukemien erotus) on helppo laskea.
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM meter_readings WHERE property_id = ? ORDER BY meter_type ASC, reading_date ASC',
      )
    : db.prepare(
        'SELECT * FROM meter_readings ORDER BY property_id ASC, meter_type ASC, reading_date ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as MeterReading[]
}

export function addMeterReading(m: Omit<MeterReading, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO meter_readings (property_id, meter_type, reading, reading_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(m.property_id, m.meter_type, m.reading, m.reading_date, m.notes)
}

export function updateMeterReading(m: MeterReading): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE meter_readings
    SET property_id = ?, meter_type = ?, reading = ?, reading_date = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    m.property_id,
    m.meter_type,
    m.reading,
    m.reading_date,
    m.notes,
    m.id,
  )
}
