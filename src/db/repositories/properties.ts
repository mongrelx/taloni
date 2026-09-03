import { initDb } from '../schema.js'
import type { CompostAssessment, Property } from '../types.js'

export function getProperties(): Property[] {
  const db = initDb()
  const stmt = db.prepare('SELECT * FROM properties ORDER BY name ASC')
  return stmt.all() as Property[]
}

const PROP_EXTRA_COLS =
  'sauna_type, sauna_info, property_tax, road_fee, electricity_fuse, water_connection, waste_provider, waste_bin, waste_interval, biowaste, compost_registered, compost_reg_date'
function propExtraValues(prop: Omit<Property, 'id'>): unknown[] {
  return [
    prop.sauna_type ?? 'none',
    prop.sauna_info ?? '',
    prop.property_tax ?? 0,
    prop.road_fee ?? 0,
    prop.electricity_fuse ?? '',
    prop.water_connection ?? '',
    prop.waste_provider ?? '',
    prop.waste_bin ?? '',
    prop.waste_interval ?? '',
    prop.biowaste ?? 'collection',
    prop.compost_registered ?? 0,
    prop.compost_reg_date ?? '',
  ]
}

export function addProperty(prop: Omit<Property, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO properties (name, kiinteistotunnus, water_source, build_year, location, ${PROP_EXTRA_COLS})
    VALUES (?, ?, ?, ?, ?, ${PROP_EXTRA_COLS.split(',')
      .map(() => '?')
      .join(', ')})
  `)
  stmt.run(
    prop.name,
    prop.kiinteistotunnus,
    prop.water_source,
    prop.build_year,
    prop.location,
    ...propExtraValues(prop),
  )
}

export function updateProperty(prop: Property): void {
  const db = initDb()
  const setClause = [
    'name',
    'kiinteistotunnus',
    'water_source',
    'build_year',
    'location',
    ...PROP_EXTRA_COLS.split(',').map((c) => c.trim()),
  ]
    .map((c) => `${c} = ?`)
    .join(', ')
  const stmt = db.prepare(`UPDATE properties SET ${setClause} WHERE id = ?`)
  stmt.run(
    prop.name,
    prop.kiinteistotunnus,
    prop.water_source,
    prop.build_year,
    prop.location,
    ...propExtraValues(prop),
    prop.id,
  )
}

// Kompostoinnin ilmoitusvelvollisuus (jätelaki 646/2011, jäteasetus 978/2021): kotikompostointi
// on ilmoitettava kunnan jätehuoltoviranomaiselle. Palauttaa null jos ei kompostoi kotona.
export function assessComposting(p: Property): CompostAssessment | null {
  if (p.biowaste !== 'home_compost') return null
  if (!p.compost_registered) {
    return {
      level: 'warning',
      message:
        'Kotikompostointi on ilmoitettava kunnan jätehuoltoviranomaiselle — ilmoitus puuttuu.',
    }
  }
  return {
    level: 'ok',
    message: `Kompostointi-ilmoitus tehty${p.compost_reg_date ? ` (${p.compost_reg_date})` : ''}.`,
  }
}

export function deleteProperty(id: number): void {
  const db = initDb()
  const stmt = db.prepare('DELETE FROM properties WHERE id = ?')
  stmt.run(id)
}
