import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runMigrations } from './migrations.js'
import { seedData } from './seed.js'

export type Db = InstanceType<typeof DatabaseSync>

let dbInstance: Db | null = null

// Tietokantatiedoston polku (~/.taloni/taloni.db). Käytetään mm. varmuuskopioinnissa.
export function getDbPath(): string {
  return join(homedir(), '.taloni', 'taloni.db')
}

export function initDb(): Db {
  if (dbInstance) return dbInstance

  const dbDir = join(homedir(), '.taloni')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'taloni.db')
  const db = new DatabaseSync(dbPath)
  dbInstance = db

  // Otetaan viite-eheys käyttöön, jotta taulujen ON DELETE CASCADE -säännöt toimivat
  // (SQLitessä foreign_keys on oletuksena pois päältä jokaisella yhteydellä).
  db.exec('PRAGMA foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kiinteistotunnus TEXT NOT NULL,
      water_source TEXT NOT NULL CHECK(water_source IN ('well', 'mains')),
      build_year INTEGER NOT NULL,
      location TEXT NOT NULL,
      sauna_type TEXT NOT NULL DEFAULT 'none' CHECK(sauna_type IN ('none', 'wood', 'electric')),
      sauna_info TEXT NOT NULL DEFAULT '',
      property_tax REAL NOT NULL DEFAULT 0,
      road_fee REAL NOT NULL DEFAULT 0,
      electricity_fuse TEXT NOT NULL DEFAULT '',
      water_connection TEXT NOT NULL DEFAULT '',
      waste_provider TEXT NOT NULL DEFAULT '',
      waste_bin TEXT NOT NULL DEFAULT '',
      waste_interval TEXT NOT NULL DEFAULT '',
      biowaste TEXT NOT NULL DEFAULT 'collection' CHECK(biowaste IN ('collection', 'home_compost', 'shared', 'none')),
      compost_registered INTEGER NOT NULL DEFAULT 0,
      compost_reg_date TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
      due_date TEXT NOT NULL,
      category TEXT NOT NULL,
      cost REAL DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'none',
      next_due TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS renovations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('planning', 'in_progress', 'completed')),
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      renovation_id INTEGER REFERENCES renovations(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS utilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      billing_date TEXT NOT NULL,
      usage_value REAL DEFAULT 0,
      billing_month TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('working', 'needs_repair', 'lost')),
      location TEXT NOT NULL,
      purchase_date TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS insurance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      policy_name TEXT NOT NULL,
      provider TEXT NOT NULL,
      premium REAL DEFAULT 0,
      renewal_date TEXT NOT NULL,
      coverage_details TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS heating_systems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('wood', 'oil', 'geothermal', 'air_heat_pump', 'electric', 'district')),
      description TEXT NOT NULL DEFAULT '',
      last_inspection TEXT,
      next_inspection TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS fireplaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      last_sweep TEXT,
      next_sweep TEXT,
      sweeper TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS wastewater_systems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('septic_tank', 'sealed_tank', 'soil_filter', 'small_treatment', 'mains_sewer')),
      permit_info TEXT NOT NULL DEFAULT '',
      last_emptied TEXT,
      next_emptied TEXT,
      emptying_provider TEXT NOT NULL DEFAULT '',
      build_year INTEGER NOT NULL DEFAULT 0,
      shoreline INTEGER NOT NULL DEFAULT 0,
      groundwater INTEGER NOT NULL DEFAULT 0,
      has_wc INTEGER NOT NULL DEFAULT 1,
      exemption INTEGER NOT NULL DEFAULT 0
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS water_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      test_date TEXT NOT NULL,
      ecoli TEXT NOT NULL DEFAULT '',
      coliforms TEXT NOT NULL DEFAULT '',
      nitrate TEXT NOT NULL DEFAULT '',
      ph TEXT NOT NULL DEFAULT '',
      iron TEXT NOT NULL DEFAULT '',
      fluoride TEXT NOT NULL DEFAULT '',
      passed INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS firewood (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      wood_type TEXT NOT NULL DEFAULT '',
      volume REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pino-m³',
      location TEXT NOT NULL DEFAULT '',
      drying_status TEXT NOT NULL DEFAULT 'ready' CHECK(drying_status IN ('fresh', 'drying', 'ready')),
      stacked_date TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      guest_name TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('tentative', 'confirmed', 'completed', 'cancelled')),
      income_recorded INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'other' CHECK(role IN ('nuohooja', 'lvi', 'sahko', 'loka', 'isannointi', 'other')),
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL DEFAULT 'other' CHECK(doc_type IN ('deed', 'purchase', 'permit', 'inspection', 'warranty', 'other')),
      title TEXT NOT NULL,
      file_path TEXT NOT NULL DEFAULT '',
      issued_date TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      linked_type TEXT NOT NULL DEFAULT '',
      linked_id INTEGER NOT NULL DEFAULT 0
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      meter_type TEXT NOT NULL DEFAULT 'electric' CHECK(meter_type IN ('electric', 'water')),
      reading REAL NOT NULL DEFAULT 0,
      reading_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS building_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('floor', 'roof', 'wall_exterior', 'wall_interior', 'paint', 'window', 'door', 'other')),
      location TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      color_code TEXT NOT NULL DEFAULT '',
      applied_date TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `)

  runMigrations(db)

  // Tarkistetaan tarvitseeko tietokantaan syöttää siemenaineisto
  const countQuery = db.prepare('SELECT COUNT(*) as count FROM properties')
  const row = countQuery.get() as { count: number }
  if (row.count === 0) {
    seedData(db)
  }

  return db
}
