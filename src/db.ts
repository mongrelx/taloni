import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Property {
  id: number
  name: string
  kiinteistotunnus: string // Format: e.g. 405-412-1-23
  water_source: 'well' | 'mains' // kaivo tai kunnan vesi
  build_year: number
  location: string
  // --- Vaihe 2: Mökkielämä ---
  sauna_type: 'none' | 'wood' | 'electric' // ei saunaa / puukiuas / sähkökiuas
  sauna_info: string // esim. "Erillinen rantasauna" tai "Talon sauna"
  property_tax: number // Kiinteistövero €/vuosi
  road_fee: number // Tiekunta / yksityistiemaksu €/vuosi
  // --- Vaihe 7: Liittymät & jätehuolto ---
  electricity_fuse: string // Sähköliittymän pääsulake, esim. "3×25 A"
  water_connection: string // Vesiliittymän koko/tyyppi, esim. "DN32" tai "Oma kaivo"
  waste_provider: string // Jätehuoltoyhtiö
  waste_bin: string // Sekajäteastian koko, esim. "240 l"
  waste_interval: string // Tyhjennysväli, esim. "4 vk"
  biowaste: 'collection' | 'home_compost' | 'shared' | 'none' // kunnan keräys / kotikompostointi / yhteiskeräys / ei biojätettä
  compost_registered: 0 | 1 // Kompostointi-ilmoitus tehty kunnalle
  compost_reg_date: string // Ilmoituksen päiväys (YYYY-MM-DD)
}

export interface CompostAssessment {
  level: 'ok' | 'warning'
  message: string
}

// Toistuvuus: 'none' = kertaluontoinen; muut ovat lakisääteisiä/määräaikaisia jaksoja.
// Kun toistuva tehtävä merkitään valmiiksi, syntyy automaattisesti seuraava esiintymä.
export type Recurrence =
  | 'none'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'every_3_years'

export interface Task {
  id: number
  property_id: number
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date: string
  category: string
  cost: number
  recurrence: Recurrence
  next_due: string | null // Seuraavan esiintymän eräpäivä (YYYY-MM-DD), null jos ei toistu
}

export interface Renovation {
  id: number
  property_id: number
  project_name: string
  status: 'planning' | 'in_progress' | 'completed'
  budget: number
  spent: number
  start_date: string
  end_date: string | null
}

export interface Transaction {
  id: number
  property_id: number
  type: 'income' | 'expense' // tulo tai meno
  category: string
  amount: number
  date: string
  description: string
}

export interface Utility {
  id: number
  property_id: number
  // Laskutyyppi: electric_siirto ja electric_energia ovat erilliset sähkölaskut
  type:
    | 'electric_siirto'
    | 'electric_energia'
    | 'water'
    | 'gas'
    | 'internet'
    | 'waste'
  amount: number
  billing_date: string // Eräpäivä (YYYY-MM-DD)
  billing_month: string // Laskutuskausi (YYYY-MM)
  usage_value: number // kWh tai m³
  provider: string // Toimittaja, esim. Caruna, Helenin sähkö
}

export interface Tool {
  id: number
  name: string
  status: 'working' | 'needs_repair' | 'lost'
  location: string
  purchase_date: string
}

export interface Insurance {
  id: number
  property_id: number
  policy_name: string
  provider: string
  premium: number
  renewal_date: string
  coverage_details: string
}

// --- Vaihe 1: Lakisääteinen ydin ---

export interface HeatingSystem {
  id: number
  property_id: number
  // Lämmitysmuoto: puu, öljy, maalämpö, ilmalämpöpumppu, sähkö, kaukolämpö
  type:
    | 'wood'
    | 'oil'
    | 'geothermal'
    | 'air_heat_pump'
    | 'electric'
    | 'district'
  description: string // esim. "Puukattila + varaaja" tai "1500 l öljysäiliö kellarissa"
  last_inspection: string | null // Viimeisin tarkastus (öljysäiliö ym.), YYYY-MM-DD
  next_inspection: string | null // Seuraava lakisääteinen tarkastus, YYYY-MM-DD
}

export type FireplaceType =
  | 'bakery_oven'
  | 'fireplace'
  | 'sauna_stove'
  | 'masonry_heater'
  | 'chimney'
  | 'kamina'
  | 'water_boiler'
  | 'wood_stove'

export interface Fireplace {
  id: number
  property_id: number
  // Tulisijan tyyppi: leivinuuni, takka, puukiuas, varaava uuni, hormi/piippu, kamina, muuripata/vesipata, puuliesi
  type: FireplaceType
  name: string // esim. "Olohuoneen takka", "Saunan puukiuas"
  last_sweep: string | null // Viimeisin nuohous, YYYY-MM-DD
  next_sweep: string | null // Seuraava nuohous (lakisääteinen, vuosittain), YYYY-MM-DD
  sweeper: string // Nuohoojan/piirin nimi
}

export interface WastewaterSystem {
  id: number
  property_id: number
  // Järjestelmätyyppi haja-asutuksen jätevesiasetuksen mukaan
  type:
    | 'septic_tank'
    | 'sealed_tank'
    | 'soil_filter'
    | 'small_treatment'
    | 'mains_sewer'
  permit_info: string // Lupatiedot / rakennusvalvonta
  last_emptied: string | null // Viimeisin loka-auton tyhjennys, YYYY-MM-DD
  next_emptied: string | null // Seuraava suunniteltu tyhjennys, YYYY-MM-DD
  emptying_provider: string // Tyhjennyspalvelu (loka-auto)
  // --- Vaihe 6: vaatimustenmukaisuuden arviointi ---
  build_year: number // Rakennusvuosi (0 = ei tiedossa)
  shoreline: 0 | 1 // Ranta-alue (≤100 m vesistöstä)
  groundwater: 0 | 1 // Luokiteltu pohjavesialue
  has_wc: 0 | 1 // Johdetaanko vesikäymälän jätevedet järjestelmään
  exemption: 0 | 1 // Ikä- tai vähäisyysvapautus voimassa
}

export interface WastewaterAssessment {
  level: 'ok' | 'warning' | 'action' // kunnossa / huomioitavaa / toimenpide tarpeen
  headline: string
  issues: string[] // Havaitut puutteet
  actions: string[] // Suositellut/pakolliset toimenpiteet
}

export interface WaterTest {
  id: number
  property_id: number
  test_date: string // Näytteenottopäivä, YYYY-MM-DD
  ecoli: string // E.coli-tulos (esim. "0 pmy/100ml")
  coliforms: string // Koliformiset bakteerit
  nitrate: string // Nitraatti (mg/l)
  ph: string // pH-arvo
  iron: string // Rauta (mg/l)
  fluoride: string // Fluoridi (mg/l)
  passed: 0 | 1 // Läpäisikö talousvesivaatimukset (1 = kyllä)
  notes: string // Vapaa huomiokenttä (laboratorio ym.)
}

export interface Firewood {
  id: number
  property_id: number
  wood_type: string // Puulaji: koivu, kuusi, mänty, leppä, haapa, sekapuu
  volume: number // Määrä valitussa yksikössä
  unit: 'pino-m³' | 'motti' | 'irto-m³' // pinokuutio, motti (= pino-m³), heitto/irtokuutio
  location: string // Varastopaikka, esim. klapiliiteri
  drying_status: 'fresh' | 'drying' | 'ready' // tuore / kuivumassa / käyttövalmis
  stacked_date: string // Pinottu (YYYY-MM-DD)
  notes: string
}

// --- Vaihe 3: Vuokraus & vuodenkierto ---

export interface Booking {
  id: number
  property_id: number
  guest_name: string // Varaajan nimi
  start_date: string // Saapuminen (YYYY-MM-DD)
  end_date: string // Lähtö (YYYY-MM-DD)
  price: number // Vuokrahinta yhteensä (€)
  status: 'tentative' | 'confirmed' | 'completed' | 'cancelled' // alustava / vahvistettu / valmis / peruttu
  income_recorded: 0 | 1 // Onko vuokratulo kirjattu taloustapahtumaksi
  notes: string
}

// --- Vaihe 4: Tukitiedot ---

export interface Contact {
  id: number
  name: string
  // Palvelurooli: nuohooja, LVI, sähkö, loka-auto, isännöinti, muu
  role: 'nuohooja' | 'lvi' | 'sahko' | 'loka' | 'isannointi' | 'other'
  phone: string
  email: string
  notes: string
}

// Asiakirjan valinnainen linkitys toiseen tietueeseen (esim. nuohoustodistus → tulisija).
export type DocumentLinkType =
  | ''
  | 'fireplace'
  | 'wastewater'
  | 'water_test'
  | 'insurance'

export interface Document {
  id: number
  property_id: number
  // Asiakirjatyyppi: lainhuuto, kauppakirja, rakennuslupa, tarkastuspöytäkirja, takuu, muu
  doc_type: 'deed' | 'purchase' | 'permit' | 'inspection' | 'warranty' | 'other'
  title: string
  file_path: string // Polku/viite tiedostoon (esim. ~/Documents/lainhuuto.pdf)
  issued_date: string // Päiväys (YYYY-MM-DD)
  notes: string
  linked_type: DocumentLinkType // Mihin tietuetyyppiin liitetty ('' = ei linkitystä)
  linked_id: number // Linkitetyn tietueen id (0 = ei linkitystä)
}

export interface MeterReading {
  id: number
  property_id: number
  meter_type: 'electric' | 'water' // Sähkö (kWh) tai vesi (m³)
  reading: number // Mittarilukema
  reading_date: string // Lukemapäivä (YYYY-MM-DD)
  notes: string
}

let dbInstance: DatabaseSync | null = null

// Tietokantatiedoston polku (~/.taloni/taloni.db). Käytetään mm. varmuuskopioinnissa.
export function getDbPath(): string {
  return join(homedir(), '.taloni', 'taloni.db')
}

export function initDb(): DatabaseSync {
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
      description TEXT NOT NULL
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

  runMigrations(db)

  // Tarkistetaan tarvitseeko tietokantaan syöttää siemenaineisto
  const countQuery = db.prepare('SELECT COUNT(*) as count FROM properties')
  const row = countQuery.get() as { count: number }
  if (row.count === 0) {
    seedData(db)
  }

  return db
}

// Migraatiot ajetaan järjestyksessä siten, että vanhat tietokannat päivittyvät uusimpaan rakenteeseen.
// `user_version` PRAGMA tallentaa SQLiteen viimeisimmän ajetun migraation indeksin.
const migrations: ((db: DatabaseSync) => void)[] = [
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
]

function runMigrations(db: DatabaseSync) {
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

function seedData(db: DatabaseSync) {
  // Properties: 3 Finnish log houses
  const insertProperty = db.prepare(`
    INSERT INTO properties (name, kiinteistotunnus, water_source, build_year, location, sauna_type, sauna_info, property_tax, road_fee,
      electricity_fuse, water_connection, waste_provider, waste_bin, waste_interval, biowaste, compost_registered, compost_reg_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Metsäpirtti: kotikompostointi ilman ilmoitusta → muistutus
  insertProperty.run(
    'Metsäpirtti',
    '405-412-1-23',
    'well',
    1948,
    'Sysmä, Finland',
    'wood',
    'Erillinen puukiuassauna pihapiirissä',
    168.0,
    120.0,
    '3×25 A',
    'Oma kaivo (rengaskaivo)',
    'Kiertokaari',
    '240 l',
    '4 vk',
    'home_compost',
    0,
    '',
  )
  insertProperty.run(
    'Järvenranta',
    '405-412-1-24',
    'well',
    1965,
    'Sysmä, Finland',
    'wood',
    'Rantasauna, Harvia puukiuas',
    142.0,
    120.0,
    '3×25 A',
    'Oma kaivo (porakaivo)',
    'Kiertokaari',
    '140 l',
    '8 vk',
    'shared',
    0,
    '',
  )
  insertProperty.run(
    'Pappila',
    '837-112-2-45',
    'mains',
    1910,
    'Tampere, Finland',
    'electric',
    'Talon sauna, sähkökiuas',
    410.0,
    0.0,
    '3×35 A',
    'DN32 (kunnan vesi)',
    'Kiertokaari',
    '660 l',
    '2 vk',
    'collection',
    0,
    '',
  )

  // Fetch created property IDs
  const props = db.prepare('SELECT id, name FROM properties').all() as {
    id: number
    name: string
  }[]
  const metsaId = props.find((p) => p.name === 'Metsäpirtti')?.id || 1
  const jarviId = props.find((p) => p.name === 'Järvenranta')?.id || 2
  const pappilaId = props.find((p) => p.name === 'Pappila')?.id || 3

  // Seeding Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (property_id, title, status, priority, due_date, category, cost, recurrence, next_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Metsäpirtti (Well water, old wood house)
  insertTask.run(
    metsaId,
    'Kaivoveden laadun analyysi',
    'pending',
    'high',
    '2026-06-15',
    'Vesi',
    120,
    'every_3_years',
    '2029-06-15',
  )
  insertTask.run(
    metsaId,
    'Hormien nuohous',
    'completed',
    'high',
    '2026-05-10',
    'Paloturvallisuus',
    65,
    'yearly',
    '2027-05-10',
  )
  insertTask.run(
    metsaId,
    'Klapien pinoaminen talveksi',
    'in_progress',
    'low',
    '2026-08-30',
    'Piha',
    0,
    'yearly',
    '2027-08-30',
  )

  // Järvenranta (Well water, lakeside cottage)
  insertTask.run(
    jarviId,
    'Saunan ulkoseinien tervaus',
    'pending',
    'medium',
    '2026-07-20',
    'Ylläpito',
    150,
    'none',
    null,
  )
  insertTask.run(
    jarviId,
    'Kaivopumpun suodattimen vaihto',
    'completed',
    'high',
    '2026-05-25',
    'Vesi',
    30,
    'yearly',
    '2027-05-25',
  )

  // Pappila (Mains water, old rectory log building in town)
  insertTask.run(
    pappilaId,
    'Rossipohjan luukkujen korjaus',
    'in_progress',
    'high',
    '2026-06-20',
    'Rakenne',
    200,
    'none',
    null,
  )
  insertTask.run(
    pappilaId,
    'Leivinuunin hormin nuohous',
    'pending',
    'medium',
    '2026-09-01',
    'Paloturvallisuus',
    85,
    'yearly',
    '2027-09-01',
  )

  // Seeding Renovations
  const insertRenovation = db.prepare(`
    INSERT INTO renovations (property_id, project_name, status, budget, spent, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insertRenovation.run(
    pappilaId,
    'Hirsikertojen korjaustyöt',
    'in_progress',
    12000,
    9400,
    '2026-05-01',
    null,
  )
  insertRenovation.run(
    jarviId,
    'Kiuasremontti ja piippu',
    'completed',
    1200,
    1150,
    '2026-04-10',
    '2026-05-03',
  )
  insertRenovation.run(
    metsaId,
    'Aurinkosähköjärjestelmä',
    'planning',
    3000,
    0,
    '2026-07-15',
    null,
  )

  // Seeding Transactions (Income / Expenses)
  const insertTransaction = db.prepare(`
    INSERT INTO transactions (property_id, type, category, amount, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  // Income
  insertTransaction.run(
    metsaId,
    'income',
    'Vuokraus',
    650.0,
    '2026-05-28',
    'Mökin vuokratulo vkl',
  )
  insertTransaction.run(
    pappilaId,
    'income',
    'Vuokraus',
    1200.0,
    '2026-05-01',
    'Kuukausivuokra',
  )
  insertTransaction.run(
    pappilaId,
    'income',
    'Metsätalous',
    350.0,
    '2026-04-15',
    'Polttopuiden myynti',
  )

  // Expenses
  insertTransaction.run(
    pappilaId,
    'expense',
    'Remontti',
    9400.0,
    '2026-05-12',
    'Hirsikorjauksen ennakko',
  )
  insertTransaction.run(
    jarviId,
    'expense',
    'Remontti',
    1150.0,
    '2026-04-20',
    'Harvia puukiuas ja teräspiippu',
  )
  insertTransaction.run(
    metsaId,
    'expense',
    'Vesi',
    120.0,
    '2026-06-01',
    'Kaivoveden laboratoriotutkimus',
  )
  insertTransaction.run(
    jarviId,
    'expense',
    'Kalusto',
    145.0,
    '2026-05-05',
    'Fiskars X27 halkaisukirves',
  )

  // Seeding Utilities (sähkö kahdessa laskussa: siirto + energia)
  const insertUtility = db.prepare(`
    INSERT INTO utilities (property_id, type, amount, billing_date, billing_month, usage_value, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  // Pappila - kunnan sähkö (Caruna siirto + Fortum energia)
  insertUtility.run(
    pappilaId,
    'electric_siirto',
    98.4,
    '2026-05-20',
    '2026-05',
    840,
    'Caruna',
  )
  insertUtility.run(
    pappilaId,
    'electric_energia',
    112.0,
    '2026-05-20',
    '2026-05',
    840,
    'Fortum',
  )
  insertUtility.run(
    pappilaId,
    'water',
    48.6,
    '2026-05-15',
    '2026-05',
    14,
    'Kunnan vesilaitos',
  )
  insertUtility.run(
    pappilaId,
    'waste',
    24.5,
    '2026-05-10',
    '2026-05',
    1,
    'Kiertokaari',
  )
  // Pappila huhtikuu
  insertUtility.run(
    pappilaId,
    'electric_siirto',
    105.2,
    '2026-04-20',
    '2026-04',
    920,
    'Caruna',
  )
  insertUtility.run(
    pappilaId,
    'electric_energia',
    124.8,
    '2026-04-20',
    '2026-04',
    920,
    'Fortum',
  )

  // Metsäpirtti (kaivovesi, sähkö mökkiin)
  insertUtility.run(
    metsaId,
    'electric_siirto',
    32.1,
    '2026-05-22',
    '2026-05',
    210,
    'Caruna',
  )
  insertUtility.run(
    metsaId,
    'electric_energia',
    42.1,
    '2026-05-22',
    '2026-05',
    210,
    'Helen',
  )
  insertUtility.run(
    metsaId,
    'waste',
    18.0,
    '2026-05-08',
    '2026-05',
    1,
    'Kiertokaari',
  )

  // Järvenranta (kaivovesi)
  insertUtility.run(
    jarviId,
    'electric_siirto',
    15.2,
    '2026-05-25',
    '2026-05',
    85,
    'Caruna',
  )
  insertUtility.run(
    jarviId,
    'electric_energia',
    20.6,
    '2026-05-25',
    '2026-05',
    85,
    'Helen',
  )

  // Seeding Tools (General inventory)
  const insertTool = db.prepare(`
    INSERT INTO tools (name, status, location, purchase_date)
    VALUES (?, ?, ?, ?)
  `)
  insertTool.run(
    'Fiskars halkaisukirves X27',
    'working',
    'Järvenrannan liiteri',
    '2026-05-05',
  )
  insertTool.run(
    'Husqvarna 130 Moottorisaha',
    'working',
    'Pappilan autotalli',
    '2025-09-12',
  )
  insertTool.run(
    'Kaivopumpun painekytkin',
    'needs_repair',
    'Metsäpirtin kellari',
    '2024-06-15',
  )
  insertTool.run(
    'Kuorimarauta hirsille',
    'working',
    'Metsäpirtin liiteri',
    '2026-04-10',
  )

  // Seeding Insurance
  const insertInsurance = db.prepare(`
    INSERT INTO insurance (property_id, policy_name, provider, premium, renewal_date, coverage_details)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  insertInsurance.run(
    metsaId,
    'Mökin täysarvovakuutus',
    'LähiTapiola',
    340.0,
    '2026-11-01',
    'Hirsirakennus, irtaimisto ja palo',
  )
  insertInsurance.run(
    jarviId,
    'Rantasaunan perusvakuutus',
    'Pohjola',
    180.0,
    '2026-12-10',
    'Saunarakennus, palo- ja luonnonilmiöt',
  )
  insertInsurance.run(
    pappilaId,
    'Päärakennuksen suojeluvakuutus',
    'If vakuutus',
    850.0,
    '2027-02-15',
    'Kulttuurihistoriallinen puutalo',
  )

  // Seeding Heating systems (Lämmitysjärjestelmät)
  const insertHeating = db.prepare(`
    INSERT INTO heating_systems (property_id, type, description, last_inspection, next_inspection)
    VALUES (?, ?, ?, ?, ?)
  `)
  insertHeating.run(
    metsaId,
    'wood',
    'Puukattila + 2000 l varaaja, tukena ilmalämpöpumppu',
    null,
    null,
  )
  insertHeating.run(
    jarviId,
    'electric',
    'Suora sähkölämmitys + puukiuas saunassa',
    null,
    null,
  )
  // Öljysäiliö vaatii määräaikaistarkastuksen (esim. 10 v välein)
  insertHeating.run(
    pappilaId,
    'oil',
    '1500 l öljysäiliö kellarissa, öljykattila',
    '2019-08-01',
    '2029-08-01',
  )

  // Seeding Fireplaces (Tulisijat & kiukaat — lakisääteinen nuohous vuosittain)
  const insertFireplace = db.prepare(`
    INSERT INTO fireplaces (property_id, type, name, last_sweep, next_sweep, sweeper)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  insertFireplace.run(
    metsaId,
    'masonry_heater',
    'Olohuoneen varaava takka',
    '2026-05-10',
    '2027-05-10',
    'Sysmän nuohouspalvelu',
  )
  insertFireplace.run(
    metsaId,
    'sauna_stove',
    'Saunan puukiuas',
    '2026-05-10',
    '2027-05-10',
    'Sysmän nuohouspalvelu',
  )
  insertFireplace.run(
    jarviId,
    'sauna_stove',
    'Rantasaunan puukiuas',
    '2026-04-20',
    '2027-04-20',
    'Sysmän nuohouspalvelu',
  )
  insertFireplace.run(
    pappilaId,
    'bakery_oven',
    'Keittiön leivinuuni',
    '2025-09-01',
    '2026-09-01',
    'Tampereen Nuohous Oy',
  )
  insertFireplace.run(
    pappilaId,
    'fireplace',
    'Salin kaakeliuuni',
    '2025-09-01',
    '2026-09-01',
    'Tampereen Nuohous Oy',
  )

  // Seeding Wastewater systems (Jätevesijärjestelmät — haja-asutuksen jätevesiasetus)
  const insertWastewater = db.prepare(`
    INSERT INTO wastewater_systems (property_id, type, permit_info, last_emptied, next_emptied, emptying_provider, build_year, shoreline, groundwater, has_wc, exemption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Metsäpirtti: vanha saostuskaivo + kivipesäimeytys, ei ranta-/pohjavesialuetta → puute, mutta ei kiinteää takarajaa
  insertWastewater.run(
    metsaId,
    'septic_tank',
    'Saostuskaivo + kivipesäimeytys (1973). Ei ranta- eikä pohjavesialuetta.',
    '2026-05-01',
    '2027-05-01',
    'Lakeuden Loka',
    1973,
    0,
    0,
    1,
    0,
  )
  // Järvenranta: rantakohde, mutta umpisäiliö (hyväksytty ratkaisu herkälläkin alueella)
  insertWastewater.run(
    jarviId,
    'sealed_tank',
    'Umpisäiliö 5 m³ (WC), harmaavesille erillinen imeytys',
    '2026-06-01',
    '2026-09-01',
    'Lakeuden Loka',
    2016,
    1,
    0,
    1,
    0,
  )
  insertWastewater.run(
    pappilaId,
    'mains_sewer',
    'Liitetty kunnalliseen viemäriverkkoon',
    null,
    null,
    '',
    2010,
    0,
    0,
    1,
    0,
  )

  // Seeding Water tests (Kaivoveden laatututkimukset — suositus 3 v välein)
  const insertWaterTest = db.prepare(`
    INSERT INTO water_tests (property_id, test_date, ecoli, coliforms, nitrate, ph, iron, fluoride, passed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertWaterTest.run(
    metsaId,
    '2023-06-14',
    '0 pmy/100ml',
    '0 pmy/100ml',
    '2.1 mg/l',
    '6.8',
    '0.05 mg/l',
    '0.3 mg/l',
    1,
    'Täyttää talousvesivaatimukset (STM 1352/2015)',
  )
  insertWaterTest.run(
    jarviId,
    '2024-07-02',
    '0 pmy/100ml',
    '3 pmy/100ml',
    '1.4 mg/l',
    '6.2',
    '0.4 mg/l',
    '0.2 mg/l',
    0,
    'Lievä rautapitoisuus ja koliformit — suositellaan uusintanäytettä',
  )

  // Seeding Firewood (Polttopuuvarasto)
  const insertFirewood = db.prepare(`
    INSERT INTO firewood (property_id, wood_type, volume, unit, location, drying_status, stacked_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertFirewood.run(
    metsaId,
    'Koivu',
    8.0,
    'pino-m³',
    'Metsäpirtin klapiliiteri',
    'ready',
    '2025-05-20',
    'Kuivunut kesän yli, käyttövalmis talveksi',
  )
  insertFirewood.run(
    metsaId,
    'Sekapuu',
    4.0,
    'pino-m³',
    'Metsäpirtin liiteri',
    'drying',
    '2026-06-01',
    'Kaadettu keväällä, kuivumassa',
  )
  insertFirewood.run(
    jarviId,
    'Leppä',
    2.5,
    'pino-m³',
    'Rantasaunan puuvaja',
    'ready',
    '2025-08-10',
    'Saunapuut',
  )
  insertFirewood.run(
    pappilaId,
    'Koivu',
    6.0,
    'motti',
    'Pappilan autotalli',
    'ready',
    '2025-09-15',
    'Ostoklapit, kuivat',
  )

  // Seeding Bookings (Vuokrauskalenteri)
  const insertBooking = db.prepare(`
    INSERT INTO bookings (property_id, guest_name, start_date, end_date, price, status, income_recorded, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertBooking.run(
    metsaId,
    'Virtanen',
    '2026-06-19',
    '2026-06-22',
    285.0,
    'completed',
    1,
    'Juhannusviikonloppu',
  )
  insertBooking.run(
    metsaId,
    'Korhonen',
    '2026-07-27',
    '2026-08-03',
    560.0,
    'confirmed',
    0,
    'Viikon vuokraus, koko perhe',
  )
  insertBooking.run(
    jarviId,
    'Nieminen',
    '2026-08-14',
    '2026-08-16',
    190.0,
    'tentative',
    0,
    'Alustava varaus, odottaa vahvistusta',
  )
  insertBooking.run(
    pappilaId,
    'Mäkelä',
    '2026-07-04',
    '2026-07-06',
    240.0,
    'confirmed',
    0,
    'Häävieraat',
  )

  // Seeding Contacts (Palveluntarjoajat)
  const insertContact = db.prepare(`
    INSERT INTO contacts (name, role, phone, email, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  insertContact.run(
    'Sysmän nuohouspalvelu',
    'nuohooja',
    '040 123 4567',
    'info@sysmannuohous.fi',
    'Piirinuohooja, Sysmän alue',
  )
  insertContact.run(
    'Tampereen Nuohous Oy',
    'nuohooja',
    '03 234 5678',
    'asiakas@trenuohous.fi',
    'Pappilan hormit',
  )
  insertContact.run(
    'Lakeuden Loka',
    'loka',
    '0200 12345',
    'tilaus@lakeudenloka.fi',
    'Sakokaivojen ja umpisäiliöiden tyhjennys',
  )
  insertContact.run(
    'LVI-Virtanen',
    'lvi',
    '045 987 6543',
    '',
    'Vesipumput ja putkistot',
  )
  insertContact.run(
    'Sähkö-Mäkinen',
    'sahko',
    '050 555 1212',
    '',
    'Sähkötyöt ja tarkastukset',
  )

  // Seeding Documents (Asiakirjat)
  const insertDocument = db.prepare(`
    INSERT INTO documents (property_id, doc_type, title, file_path, issued_date, notes, linked_type, linked_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertDocument.run(
    metsaId,
    'deed',
    'Lainhuutotodistus',
    '~/Documents/metsapirtti-lainhuuto.pdf',
    '2018-03-12',
    'Lainhuuto rekisteröity',
    '',
    0,
  )
  insertDocument.run(
    metsaId,
    'inspection',
    'Kaivoveden tutkimustodistus 2023',
    '~/Documents/metsapirtti-vesi-2023.pdf',
    '2023-06-20',
    'Laboratorion lausunto',
    '',
    0,
  )
  insertDocument.run(
    pappilaId,
    'permit',
    'Rakennuslupa hirsikorjaus',
    '~/Documents/pappila-rakennuslupa.pdf',
    '2026-04-28',
    'Tampereen rakennusvalvonta',
    '',
    0,
  )
  insertDocument.run(
    pappilaId,
    'purchase',
    'Kauppakirja',
    '~/Documents/pappila-kauppakirja.pdf',
    '2010-09-01',
    '',
    '',
    0,
  )
  insertDocument.run(
    jarviId,
    'warranty',
    'Harvia-kiukaan takuutodistus',
    '~/Documents/jarvenranta-kiuas-takuu.pdf',
    '2026-05-03',
    'Takuu 2 vuotta',
    '',
    0,
  )

  // Nuohoustodistus liitettynä Metsäpirtin varaavaan takkaan (ensimmäinen fireplace-rivi)
  const firstMetsaFireplace = db
    .prepare(
      'SELECT id FROM fireplaces WHERE property_id = ? ORDER BY id ASC LIMIT 1',
    )
    .get(metsaId) as { id: number } | undefined
  if (firstMetsaFireplace) {
    insertDocument.run(
      metsaId,
      'inspection',
      'Nuohoustodistus 2026',
      '~/Documents/metsapirtti-nuohous-2026.pdf',
      '2026-05-10',
      'Sysmän nuohouspalvelu',
      'fireplace',
      firstMetsaFireplace.id,
    )
  }

  // Seeding Meter readings (Mittarilukemat)
  const insertMeter = db.prepare(`
    INSERT INTO meter_readings (property_id, meter_type, reading, reading_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  insertMeter.run(
    pappilaId,
    'electric',
    24500,
    '2026-04-01',
    'Vuosineljänneksen alku',
  )
  insertMeter.run(pappilaId, 'electric', 25420, '2026-05-01', '')
  insertMeter.run(pappilaId, 'electric', 26260, '2026-06-01', '')
  insertMeter.run(metsaId, 'electric', 8100, '2026-05-01', 'Mökkisähkö')
  insertMeter.run(metsaId, 'electric', 8310, '2026-06-01', '')
}

// Queries
export function getProperties(): Property[] {
  const db = initDb()
  const stmt = db.prepare('SELECT * FROM properties ORDER BY name ASC')
  return stmt.all() as Property[]
}

export function getTasks(propertyId?: number): Task[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM tasks WHERE property_id = ? ORDER BY status ASC, due_date ASC',
      )
    : db.prepare('SELECT * FROM tasks ORDER BY status ASC, due_date ASC')
  return (propertyId ? query.all(propertyId) : query.all()) as Task[]
}

export function getRenovations(propertyId?: number): Renovation[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM renovations WHERE property_id = ? ORDER BY status DESC, start_date DESC',
      )
    : db.prepare(
        'SELECT * FROM renovations ORDER BY status DESC, start_date DESC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Renovation[]
}

export function getTransactions(propertyId?: number): Transaction[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM transactions WHERE property_id = ? ORDER BY date DESC',
      )
    : db.prepare('SELECT * FROM transactions ORDER BY date DESC')
  return (propertyId ? query.all(propertyId) : query.all()) as Transaction[]
}

export function getUtilities(propertyId?: number): Utility[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM utilities WHERE property_id = ? ORDER BY billing_month DESC, type ASC',
      )
    : db.prepare(
        'SELECT * FROM utilities ORDER BY billing_month DESC, property_id ASC, type ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Utility[]
}

export function getTools(): Tool[] {
  const db = initDb()
  const stmt = db.prepare('SELECT * FROM tools ORDER BY status DESC, name ASC')
  return stmt.all() as Tool[]
}

export function getInsurance(propertyId?: number): Insurance[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM insurance WHERE property_id = ? ORDER BY renewal_date ASC',
      )
    : db.prepare('SELECT * FROM insurance ORDER BY renewal_date ASC')
  return (propertyId ? query.all(propertyId) : query.all()) as Insurance[]
}

// Mutations
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

export function addTransaction(tx: Omit<Transaction, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO transactions (property_id, type, category, amount, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    tx.property_id,
    tx.type,
    tx.category,
    tx.amount,
    tx.date,
    tx.description,
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

export function updateTransaction(tx: Transaction): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE transactions 
    SET property_id = ?, type = ?, category = ?, amount = ?, description = ? 
    WHERE id = ?
  `)
  stmt.run(
    tx.property_id,
    tx.type,
    tx.category,
    tx.amount,
    tx.description,
    tx.id,
  )
}

export type DeletableTable =
  | 'tasks'
  | 'renovations'
  | 'transactions'
  | 'utilities'
  | 'tools'
  | 'insurance'
  | 'heating_systems'
  | 'fireplaces'
  | 'wastewater_systems'
  | 'water_tests'
  | 'firewood'
  | 'bookings'
  | 'contacts'
  | 'documents'
  | 'meter_readings'

export function deleteRow(table: DeletableTable, id: number): void {
  const db = initDb()
  const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
  stmt.run(id)
}

export function addUtility(u: Omit<Utility, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO utilities (property_id, type, amount, billing_date, billing_month, usage_value, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    u.property_id,
    u.type,
    u.amount,
    u.billing_date,
    u.billing_month,
    u.usage_value,
    u.provider,
  )
}

export function updateUtility(u: Utility): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE utilities
    SET property_id = ?, type = ?, amount = ?, billing_date = ?, billing_month = ?, usage_value = ?, provider = ?
    WHERE id = ?
  `)
  stmt.run(
    u.property_id,
    u.type,
    u.amount,
    u.billing_date,
    u.billing_month,
    u.usage_value,
    u.provider,
    u.id,
  )
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

export function addRenovation(ren: Omit<Renovation, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO renovations (property_id, project_name, status, budget, spent, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    ren.property_id,
    ren.project_name,
    ren.status,
    ren.budget,
    ren.spent,
    ren.start_date,
    ren.end_date,
  )
}

export function updateRenovation(ren: Renovation): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE renovations
    SET property_id = ?, project_name = ?, status = ?, budget = ?, spent = ?, start_date = ?, end_date = ?
    WHERE id = ?
  `)
  stmt.run(
    ren.property_id,
    ren.project_name,
    ren.status,
    ren.budget,
    ren.spent,
    ren.start_date,
    ren.end_date,
    ren.id,
  )
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

export function addInsurance(i: Omit<Insurance, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO insurance (property_id, policy_name, provider, premium, renewal_date, coverage_details)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    i.property_id,
    i.policy_name,
    i.provider,
    i.premium,
    i.renewal_date,
    i.coverage_details,
  )
}

export function updateInsurance(i: Insurance): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE insurance
    SET property_id = ?, policy_name = ?, provider = ?, premium = ?, renewal_date = ?, coverage_details = ?
    WHERE id = ?
  `)
  stmt.run(
    i.property_id,
    i.policy_name,
    i.provider,
    i.premium,
    i.renewal_date,
    i.coverage_details,
    i.id,
  )
}

// --- Vaihe 1: Lakisääteinen ydin — kyselyt ja muutokset ---

export function getHeatingSystems(propertyId?: number): HeatingSystem[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM heating_systems WHERE property_id = ? ORDER BY next_inspection ASC',
      )
    : db.prepare(
        'SELECT * FROM heating_systems ORDER BY property_id ASC, next_inspection ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as HeatingSystem[]
}

export function addHeatingSystem(h: Omit<HeatingSystem, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO heating_systems (property_id, type, description, last_inspection, next_inspection)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(
    h.property_id,
    h.type,
    h.description,
    h.last_inspection ?? null,
    h.next_inspection ?? null,
  )
}

export function updateHeatingSystem(h: HeatingSystem): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE heating_systems
    SET property_id = ?, type = ?, description = ?, last_inspection = ?, next_inspection = ?
    WHERE id = ?
  `)
  stmt.run(
    h.property_id,
    h.type,
    h.description,
    h.last_inspection ?? null,
    h.next_inspection ?? null,
    h.id,
  )
}

export function getFireplaces(propertyId?: number): Fireplace[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM fireplaces WHERE property_id = ? ORDER BY next_sweep ASC',
      )
    : db.prepare(
        'SELECT * FROM fireplaces ORDER BY property_id ASC, next_sweep ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Fireplace[]
}

export function addFireplace(f: Omit<Fireplace, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO fireplaces (property_id, type, name, last_sweep, next_sweep, sweeper)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    f.property_id,
    f.type,
    f.name,
    f.last_sweep ?? null,
    f.next_sweep ?? null,
    f.sweeper,
  )
}

export function updateFireplace(f: Fireplace): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE fireplaces
    SET property_id = ?, type = ?, name = ?, last_sweep = ?, next_sweep = ?, sweeper = ?
    WHERE id = ?
  `)
  stmt.run(
    f.property_id,
    f.type,
    f.name,
    f.last_sweep ?? null,
    f.next_sweep ?? null,
    f.sweeper,
    f.id,
  )
}

export function getWastewaterSystems(propertyId?: number): WastewaterSystem[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM wastewater_systems WHERE property_id = ? ORDER BY next_emptied ASC',
      )
    : db.prepare(
        'SELECT * FROM wastewater_systems ORDER BY property_id ASC, next_emptied ASC',
      )
  return (
    propertyId ? query.all(propertyId) : query.all()
  ) as WastewaterSystem[]
}

export function addWastewaterSystem(w: Omit<WastewaterSystem, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO wastewater_systems (property_id, type, permit_info, last_emptied, next_emptied, emptying_provider, build_year, shoreline, groundwater, has_wc, exemption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    w.property_id,
    w.type,
    w.permit_info,
    w.last_emptied ?? null,
    w.next_emptied ?? null,
    w.emptying_provider,
    w.build_year ?? 0,
    w.shoreline ?? 0,
    w.groundwater ?? 0,
    w.has_wc ?? 1,
    w.exemption ?? 0,
  )
}

export function updateWastewaterSystem(w: WastewaterSystem): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE wastewater_systems
    SET property_id = ?, type = ?, permit_info = ?, last_emptied = ?, next_emptied = ?, emptying_provider = ?, build_year = ?, shoreline = ?, groundwater = ?, has_wc = ?, exemption = ?
    WHERE id = ?
  `)
  stmt.run(
    w.property_id,
    w.type,
    w.permit_info,
    w.last_emptied ?? null,
    w.next_emptied ?? null,
    w.emptying_provider,
    w.build_year ?? 0,
    w.shoreline ?? 0,
    w.groundwater ?? 0,
    w.has_wc ?? 1,
    w.exemption ?? 0,
    w.id,
  )
}

// Arvioi jätevesijärjestelmän vaatimustenmukaisuuden (haja-asutuksen jätevesiasetus VNa 157/2017
// ja ympäristönsuojelulaki). HUOM: tämä on informatiivinen arvio, ei viranomaispäätös — kunnan
// ympäristönsuojeluviranomainen voi antaa tiukempia paikallisia määräyksiä.
export function assessWastewater(w: WastewaterSystem): WastewaterAssessment {
  const issues: string[] = []
  const actions: string[] = [
    'Pidä ajan tasalla selvitys jätevesijärjestelmästä sekä käyttö- ja huolto-ohje.',
  ]
  // Tyhjennysmuistutus koskee saostus- ja umpisäiliöitä.
  if (w.type === 'septic_tank' || w.type === 'soil_filter') {
    actions.push('Tyhjennä saostuskaivo lietteestä vähintään kerran vuodessa.')
  }
  if (w.type === 'sealed_tank') {
    actions.push(
      'Seuraa umpisäiliön täyttymistä ja tilaa tyhjennys ajoissa (täyttöhälytin suositeltava).',
    )
  }

  // Kunnan viemäri: ei kiinteistökohtaisia puhdistusvaatimuksia.
  if (w.type === 'mains_sewer') {
    return {
      level: 'ok',
      headline:
        'Liitetty kunnalliseen viemäriin — ei kiinteistökohtaisia puhdistusvaatimuksia.',
      issues: [],
      actions: [],
    }
  }

  // Onko käsittely riittävä nykyvaatimuksiin?
  let inadequate = false
  if (w.type === 'septic_tank') {
    inadequate = true
    issues.push(
      'Pelkkä saostuskaivo (esim. + kivipesäimeytys) on vain esikäsittely eikä täytä VNa 157/2017 puhdistusvaatimuksia (orgaaninen aine 80 % / fosfori 70 % / typpi 30 %).',
    )
  } else if (
    w.type === 'soil_filter' &&
    w.build_year > 0 &&
    w.build_year < 2004
  ) {
    inadequate = true
    issues.push(
      'Ennen nykyvaatimuksia rakennettu maasuodattamo ei välttämättä täytä puhdistusvaatimuksia — tarkistuta kunto ja puhdistusteho.',
    )
  }

  // Riittävä ratkaisu (umpisäiliö, pienpuhdistamo, uudehko maasuodattamo).
  if (!inadequate) {
    const hl =
      w.type === 'sealed_tank'
        ? 'Umpisäiliö on hyväksytty ratkaisu — huolehdi tyhjennyksestä.'
        : w.type === 'small_treatment'
          ? 'Pienpuhdistamo — huolehdi säännöllisestä huollosta ja seurannasta.'
          : 'Järjestelmä vaikuttaa täyttävän vaatimukset — huolehdi määräaikaishuollosta.'
    return { level: 'ok', headline: hl, issues, actions }
  }

  // Vähäiset jätevedet (ei vesikäymälää): kevyemmät vaatimukset.
  if (!w.has_wc) {
    issues.push(
      'Ei vesikäymälää → "vähäiset jätevedet": vaatimukset kevyemmät (harmaavesien käsittely riittää usein).',
    )
    return {
      level: 'warning',
      headline:
        'Vähäiset jätevedet — kevyemmät vaatimukset, mutta varmista riittävyys.',
      issues,
      actions,
    }
  }

  // Vapautus voimassa (ikä ≥ syntynyt ennen 9.3.1943 / vähäisyys).
  if (w.exemption) {
    issues.push(
      'Vapautus merkitty voimassa olevaksi (ikä-/vähäisyysperuste) — voimassaolo kannattaa varmistaa kunnalta.',
    )
    return {
      level: 'warning',
      headline:
        'Puute tunnistettu, mutta vapautus voi olla voimassa — varmista kunnalta.',
      issues,
      actions,
    }
  }

  // Herkkä alue (ranta ≤100 m tai pohjavesialue): lakisääteinen takaraja oli 31.10.2019.
  if (w.shoreline || w.groundwater) {
    const alue =
      w.shoreline && w.groundwater
        ? 'ranta- ja pohjavesialue'
        : w.shoreline
          ? 'ranta-alue (≤100 m vesistöstä)'
          : 'pohjavesialue'
    actions.unshift(
      `Herkkä alue (${alue}): saata järjestelmä vaatimusten mukaiseksi — lakisääteinen takaraja oli jo 31.10.2019.`,
    )
    return {
      level: 'action',
      headline: `Toimenpide tarpeen: herkän alueen takaraja (31.10.2019) on ohitettu.`,
      issues,
      actions,
    }
  }

  // Ei herkällä alueella: ei kiinteää takarajaa, korjaus kytkeytyy remonttiin.
  actions.unshift(
    'Ei kiinteää takarajaa (ei herkkä alue): korjausvelvoite laukeaa luvanvaraisen remontin tai vesi-/viemäri-/wc-korjauksen yhteydessä. Suositus: suunnittele päivitys.',
  )
  return {
    level: 'warning',
    headline:
      'Puute tunnistettu — ei kiinteää takarajaa, mutta korjaus tulee tehdä remontin yhteydessä.',
    issues,
    actions,
  }
}

export function getWaterTests(propertyId?: number): WaterTest[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM water_tests WHERE property_id = ? ORDER BY test_date DESC',
      )
    : db.prepare('SELECT * FROM water_tests ORDER BY test_date DESC')
  return (propertyId ? query.all(propertyId) : query.all()) as WaterTest[]
}

export function addWaterTest(t: Omit<WaterTest, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO water_tests (property_id, test_date, ecoli, coliforms, nitrate, ph, iron, fluoride, passed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    t.property_id,
    t.test_date,
    t.ecoli,
    t.coliforms,
    t.nitrate,
    t.ph,
    t.iron,
    t.fluoride,
    t.passed,
    t.notes,
  )
}

export function updateWaterTest(t: WaterTest): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE water_tests
    SET property_id = ?, test_date = ?, ecoli = ?, coliforms = ?, nitrate = ?, ph = ?, iron = ?, fluoride = ?, passed = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    t.property_id,
    t.test_date,
    t.ecoli,
    t.coliforms,
    t.nitrate,
    t.ph,
    t.iron,
    t.fluoride,
    t.passed,
    t.notes,
    t.id,
  )
}

// --- Vaihe 2: Polttopuuvarasto — kyselyt ja muutokset ---

export function getFirewood(propertyId?: number): Firewood[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM firewood WHERE property_id = ? ORDER BY drying_status ASC, wood_type ASC',
      )
    : db.prepare(
        'SELECT * FROM firewood ORDER BY property_id ASC, drying_status ASC, wood_type ASC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Firewood[]
}

export function addFirewood(f: Omit<Firewood, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO firewood (property_id, wood_type, volume, unit, location, drying_status, stacked_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    f.property_id,
    f.wood_type,
    f.volume,
    f.unit,
    f.location,
    f.drying_status,
    f.stacked_date,
    f.notes,
  )
}

export function updateFirewood(f: Firewood): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE firewood
    SET property_id = ?, wood_type = ?, volume = ?, unit = ?, location = ?, drying_status = ?, stacked_date = ?, notes = ?
    WHERE id = ?
  `)
  stmt.run(
    f.property_id,
    f.wood_type,
    f.volume,
    f.unit,
    f.location,
    f.drying_status,
    f.stacked_date,
    f.notes,
    f.id,
  )
}

// --- Vaihe 3: Vuokraus — kyselyt ja muutokset ---

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

// --- Vaihe 4: Tukitiedot — kyselyt ja muutokset ---

export function getContacts(): Contact[] {
  const db = initDb()
  // Yhteystiedot ovat globaaleja (eivät kohdekohtaisia) — palveluntarjoajat palvelevat kaikkia kiinteistöjä.
  return db
    .prepare('SELECT * FROM contacts ORDER BY role ASC, name ASC')
    .all() as Contact[]
}

export function addContact(c: Omit<Contact, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(
    'INSERT INTO contacts (name, role, phone, email, notes) VALUES (?, ?, ?, ?, ?)',
  )
  stmt.run(c.name, c.role, c.phone, c.email, c.notes)
}

export function updateContact(c: Contact): void {
  const db = initDb()
  const stmt = db.prepare(
    'UPDATE contacts SET name = ?, role = ?, phone = ?, email = ?, notes = ? WHERE id = ?',
  )
  stmt.run(c.name, c.role, c.phone, c.email, c.notes, c.id)
}

export function getDocuments(propertyId?: number): Document[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM documents WHERE property_id = ? ORDER BY issued_date DESC',
      )
    : db.prepare(
        'SELECT * FROM documents ORDER BY property_id ASC, issued_date DESC',
      )
  return (propertyId ? query.all(propertyId) : query.all()) as Document[]
}

export function addDocument(d: Omit<Document, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO documents (property_id, doc_type, title, file_path, issued_date, notes, linked_type, linked_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    d.property_id,
    d.doc_type,
    d.title,
    d.file_path,
    d.issued_date,
    d.notes,
    d.linked_type ?? '',
    d.linked_id ?? 0,
  )
}

export function updateDocument(d: Document): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE documents
    SET property_id = ?, doc_type = ?, title = ?, file_path = ?, issued_date = ?, notes = ?, linked_type = ?, linked_id = ?
    WHERE id = ?
  `)
  stmt.run(
    d.property_id,
    d.doc_type,
    d.title,
    d.file_path,
    d.issued_date,
    d.notes,
    d.linked_type ?? '',
    d.linked_id ?? 0,
    d.id,
  )
}

// Palauttaa tiettyyn tietueeseen linkitetyt asiakirjat (esim. tulisijan nuohoustodistukset).
export function getDocumentsFor(
  linkedType: DocumentLinkType,
  linkedId: number,
): Document[] {
  const db = initDb()
  return db
    .prepare(
      'SELECT * FROM documents WHERE linked_type = ? AND linked_id = ? ORDER BY issued_date DESC',
    )
    .all(linkedType, linkedId) as Document[]
}

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
