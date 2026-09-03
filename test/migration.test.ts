import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

// Rakennetaan vanha v1-tietokanta (ilman recurrence/next_due-sarakkeita ja Vaihe 2–4 tauluja)
// ja varmistetaan että initDb migratoi sen uusimpaan rakenteeseen dataa menettämättä.
const home = mkdtempSync(join(tmpdir(), 'taloni-mig-'))
process.env.HOME = home
mkdirSync(join(home, '.taloni'), { recursive: true })
const dbPath = join(home, '.taloni', 'taloni.db')

const old = new DatabaseSync(dbPath)
old.exec(
  `CREATE TABLE properties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kiinteistotunnus TEXT NOT NULL, water_source TEXT NOT NULL, build_year INTEGER NOT NULL, location TEXT NOT NULL);`,
)
old.exec(
  `CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, property_id INTEGER NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT NOT NULL, category TEXT NOT NULL, cost REAL DEFAULT 0);`,
)
old.exec(
  `INSERT INTO properties (name, kiinteistotunnus, water_source, build_year, location) VALUES ('Vanha talo','1-1-1-1','well',1950,'Sysmä');`,
)
old.exec(
  `INSERT INTO tasks (property_id, title, status, priority, due_date, category, cost) VALUES (1,'Vanha tehtävä','pending','high','2026-06-01','Vesi',50);`,
)
// Vanha transactions-taulu (ilman renovation_id-saraketta) v8-migraation testaamiseksi.
old.exec(
  `CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, property_id INTEGER NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL);`,
)
old.exec(
  `INSERT INTO transactions (property_id, type, category, amount, date, description) VALUES (1,'expense','Remontti',100,'2026-01-01','Vanha kulu');`,
)
old.exec(`PRAGMA user_version = 1`)
old.close()

test('old v1 database migrates without data loss', async () => {
  const db = await import('../src/db/index.ts')
  db.initDb()

  // Vanha data säilyy
  const props = db.getProperties()
  assert.equal(props.length, 1)
  assert.equal(props[0]!.name, 'Vanha talo')

  // Uudet sarakkeet oletusarvoilla
  const task = db.getTasks()[0]!
  assert.equal(task.recurrence, 'none')
  assert.equal(task.next_due, null)
  assert.equal(props[0]!.sauna_type, 'none')
  assert.equal(props[0]!.property_tax, 0)
  // Vaihe 7 -sarakkeet oletusarvoilla
  assert.equal(props[0]!.electricity_fuse, '')
  assert.equal(props[0]!.biowaste, 'collection')
  assert.equal(props[0]!.compost_registered, 0)

  // Uudet Vaihe 1–4 taulut ovat käytettävissä (tyhjinä)
  assert.equal(db.getFireplaces().length, 0)
  assert.equal(db.getBookings().length, 0)
  assert.equal(db.getContacts().length, 0)
  assert.equal(db.getMeterReadings().length, 0)

  // Siemenaineistoa EI ajeta olemassa olevaan tietokantaan
  assert.equal(db.getProperties().length, 1)

  // v8: vanha transactions-rivi säilyy, renovation_id lisätään oletusarvolla null
  const txs = db.getTransactions()
  assert.equal(txs.length, 1)
  assert.equal(txs[0]!.description, 'Vanha kulu')
  assert.equal(txs[0]!.renovation_id, null)

  // v9: energiatehokkuuden sarakkeet lisätään oletusarvoilla
  assert.equal(props[0]!.floor_area, 0)
  assert.equal(props[0]!.energy_rating, '')
  assert.equal(props[0]!.energy_cert_date, '')
  assert.equal(props[0]!.energy_cert_valid_until, '')
})
