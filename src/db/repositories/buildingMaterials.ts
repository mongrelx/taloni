import { initDb } from '../schema.js'
import type { BuildingMaterial } from '../types.js'

export function getBuildingMaterials(propertyId?: number): BuildingMaterial[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM building_materials WHERE property_id = ? ORDER BY category ASC, location ASC',
      )
    : db.prepare(
        'SELECT * FROM building_materials ORDER BY category ASC, location ASC',
      )
  return (
    propertyId ? query.all(propertyId) : query.all()
  ) as BuildingMaterial[]
}

export function addBuildingMaterial(b: Omit<BuildingMaterial, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO building_materials (property_id, category, location, material, manufacturer, color_code, applied_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    b.property_id,
    b.category,
    b.location,
    b.material,
    b.manufacturer,
    b.color_code,
    b.applied_date,
    b.notes,
  )
}

export function updateBuildingMaterial(b: BuildingMaterial): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE building_materials
    SET property_id = ?, category = ?, location = ?, material = ?, manufacturer = ?, color_code = ?, applied_date = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    b.property_id,
    b.category,
    b.location,
    b.material,
    b.manufacturer,
    b.color_code,
    b.applied_date,
    b.notes,
    b.id,
  )
}
