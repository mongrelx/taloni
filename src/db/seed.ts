import type { Db } from './schema.js'

export function seedData(db: Db) {
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

  const insertMaterial = db.prepare(`
    INSERT INTO building_materials (property_id, category, location, material, manufacturer, color_code, applied_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertMaterial.run(
    metsaId,
    'paint',
    'Ulkoseinät',
    'Punamulta / Keittomaali',
    'Virtasen Maalitehdas',
    'Falu rödfärg / Punainen',
    '2022-07-15',
    'Perinteinen keittomaali hirsipinnalle',
  )
  insertMaterial.run(
    metsaId,
    'roof',
    'Katto',
    'Peltikatto (Kourukate)',
    'Ruukki',
    'Tummanharmaa RR23',
    '2015-08-10',
    'Konesaumattu peltikate',
  )
  insertMaterial.run(
    jarviId,
    'floor',
    'Tupa / Olohuone',
    'Mäntylautalattia 28mm',
    'Puukeskus',
    'Kirkas öljyvaha',
    '2020-06-01',
    'Lipeäkäsitelty ja öljyvahattu',
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
