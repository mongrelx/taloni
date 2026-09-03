import type { Db } from './schema.js'

// Migraatiot ajetaan järjestyksessä siten, että vanhat tietokannat päivittyvät uusimpaan rakenteeseen.
// `user_version` PRAGMA tallentaa SQLiteen viimeisimmän ajetun migraation indeksin.
export const migrations: ((db: Db) => void)[] = [
  // v1: lisää billing_month + provider sarakkeet vanhempiin utilities-tauluihin
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(utilities)').all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('billing_month')) {
      db.exec(
        "ALTER TABLE utilities ADD COLUMN billing_month TEXT NOT NULL DEFAULT ''",
      )
    }
    if (!cols.includes('provider')) {
      db.exec(
        "ALTER TABLE utilities ADD COLUMN provider TEXT NOT NULL DEFAULT ''",
      )
    }
  },
  // v2: lisää toistuvuustuki tasks-tauluun (recurrence + next_due). Uudet Vaihe 1 -taulut
  // (heating_systems, fireplaces, wastewater_systems, water_tests) luodaan initDb:n
  // CREATE TABLE IF NOT EXISTS -lauseilla, joten ne eivät tarvitse erillistä migraatiota.
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('recurrence')) {
      db.exec(
        "ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'",
      )
    }
    if (!cols.includes('next_due')) {
      db.exec('ALTER TABLE tasks ADD COLUMN next_due TEXT')
    }
  },
  // v3: Vaihe 2 — sauna + kiinteistövero + tiekunta properties-tauluun. firewood-taulu
  // luodaan CREATE TABLE IF NOT EXISTS -lauseella, joten se ei tarvitse migraatiota.
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(properties)').all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('sauna_type')) {
      db.exec(
        "ALTER TABLE properties ADD COLUMN sauna_type TEXT NOT NULL DEFAULT 'none'",
      )
    }
    if (!cols.includes('sauna_info')) {
      db.exec(
        "ALTER TABLE properties ADD COLUMN sauna_info TEXT NOT NULL DEFAULT ''",
      )
    }
    if (!cols.includes('property_tax')) {
      db.exec(
        'ALTER TABLE properties ADD COLUMN property_tax REAL NOT NULL DEFAULT 0',
      )
    }
    if (!cols.includes('road_fee')) {
      db.exec(
        'ALTER TABLE properties ADD COLUMN road_fee REAL NOT NULL DEFAULT 0',
      )
    }
  },
  // v4: Vaihe 6 — jätevesijärjestelmän vaatimustenmukaisuuden arvioinnin kentät.
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(wastewater_systems)').all() as {
        name: string
      }[]
    ).map((c) => c.name)
    const add = (name: string, decl: string) => {
      if (!cols.includes(name))
        db.exec(`ALTER TABLE wastewater_systems ADD COLUMN ${name} ${decl}`)
    }
    add('build_year', 'INTEGER NOT NULL DEFAULT 0')
    add('shoreline', 'INTEGER NOT NULL DEFAULT 0')
    add('groundwater', 'INTEGER NOT NULL DEFAULT 0')
    add('has_wc', 'INTEGER NOT NULL DEFAULT 1')
    add('exemption', 'INTEGER NOT NULL DEFAULT 0')
  },
  // v5: Vaihe 7 — liittymäkoot ja jätehuolto/kompostointi properties-tauluun.
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(properties)').all() as { name: string }[]
    ).map((c) => c.name)
    const add = (name: string, decl: string) => {
      if (!cols.includes(name))
        db.exec(`ALTER TABLE properties ADD COLUMN ${name} ${decl}`)
    }
    add('electricity_fuse', "TEXT NOT NULL DEFAULT ''")
    add('water_connection', "TEXT NOT NULL DEFAULT ''")
    add('waste_provider', "TEXT NOT NULL DEFAULT ''")
    add('waste_bin', "TEXT NOT NULL DEFAULT ''")
    add('waste_interval', "TEXT NOT NULL DEFAULT ''")
    add('biowaste', "TEXT NOT NULL DEFAULT 'collection'")
    add('compost_registered', 'INTEGER NOT NULL DEFAULT 0')
    add('compost_reg_date', "TEXT NOT NULL DEFAULT ''")
  },
  // v6: Vaihe 8 — asiakirjan linkitys tietueeseen (nuohoustodistus → tulisija ym.).
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(documents)').all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('linked_type'))
      db.exec(
        "ALTER TABLE documents ADD COLUMN linked_type TEXT NOT NULL DEFAULT ''",
      )
    if (!cols.includes('linked_id'))
      db.exec(
        'ALTER TABLE documents ADD COLUMN linked_id INTEGER NOT NULL DEFAULT 0',
      )
  },
  // v7: Vaihe 9 — poista fireplaces.type CHECK-rajoite, jotta uudet tyypit (kamina, muuripata,
  // puuliesi) sallitaan. SQLite ei salli CHECK-rajoitteen muutosta ALTERilla, joten taulu
  // rakennetaan uudelleen. Viite-eheys pois päältä rakennuksen ajaksi.
  (db) => {
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('ALTER TABLE fireplaces RENAME TO fireplaces_old')
    db.exec(`
      CREATE TABLE fireplaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        last_sweep TEXT,
        next_sweep TEXT,
        sweeper TEXT NOT NULL DEFAULT ''
      );
    `)
    db.exec(
      'INSERT INTO fireplaces (id, property_id, type, name, last_sweep, next_sweep, sweeper) SELECT id, property_id, type, name, last_sweep, next_sweep, sweeper FROM fireplaces_old',
    )
    db.exec('DROP TABLE fireplaces_old')
    db.exec('PRAGMA foreign_keys = ON')
  },
  // v8: Remontin kulujen linkitys — transactions.renovation_id, jotta taloustapahtuma
  // voidaan yhdistää tiettyyn remonttiprojektiin (budjetti vs. toteutunut -vertailu).
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(transactions)').all() as {
        name: string
      }[]
    ).map((c) => c.name)
    if (!cols.includes('renovation_id')) {
      db.exec(
        'ALTER TABLE transactions ADD COLUMN renovation_id INTEGER REFERENCES renovations(id) ON DELETE SET NULL',
      )
    }
  },
  // v9: Energiatehokkuus — pinta-ala (kulutuksen kWh/m² laskentaan) ja energiatodistuksen tiedot.
  (db) => {
    const cols = (
      db.prepare('PRAGMA table_info(properties)').all() as { name: string }[]
    ).map((c) => c.name)
    const add = (name: string, decl: string) => {
      if (!cols.includes(name))
        db.exec(`ALTER TABLE properties ADD COLUMN ${name} ${decl}`)
    }
    add('floor_area', 'REAL NOT NULL DEFAULT 0')
    add('energy_rating', "TEXT NOT NULL DEFAULT ''")
    add('energy_cert_date', "TEXT NOT NULL DEFAULT ''")
    add('energy_cert_valid_until', "TEXT NOT NULL DEFAULT ''")
  },
]

export function runMigrations(db: Db) {
  const row = db.prepare('PRAGMA user_version').get() as {
    user_version: number
  }
  const current = row.user_version ?? 0
  for (let i = current; i < migrations.length; i++) {
    migrations[i]!(db)
  }
  if (migrations.length > current) {
    // SQLite ei salli sidottuja parametreja PRAGMA-lauseessa; arvo tulee aina koodista, joten interpolaatio on turvallinen.
    db.exec(`PRAGMA user_version = ${migrations.length}`)
  }
}
