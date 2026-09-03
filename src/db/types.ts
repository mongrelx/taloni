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
  // --- Energiatehokkuus ---
  floor_area: number // Lämmitetty pinta-ala m² (0 = ei tiedossa) — käytetään kulutuksen (kWh/m²/v) laskentaan
  energy_rating: EnergyRating // Energiatodistuksen luokka ('' = ei todistusta/ei tiedossa)
  energy_cert_date: string // Energiatodistuksen laadintapäivä (YYYY-MM-DD, tyhjä = ei todistusta)
  energy_cert_valid_until: string // Energiatodistuksen voimassaolon päättyminen (YYYY-MM-DD)
}

export type EnergyRating = '' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface EnergyAssessment {
  suggestions: string[] // Informatiivisia parannusehdotuksia (ei asiantuntija-arvio)
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
  renovation_id: number | null // Linkitetty remonttiprojekti (budjetti vs. toteutunut), null = ei linkitystä
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

// --- Rakennus- ja pintamateriaalit ---

export type MaterialCategory =
  | 'floor' // Lattia (parketti, laatta, laminaatti, vinyl, betoni)
  | 'roof' // Katto (peltikatto, tiilikatto, turvekatto, päre)
  | 'wall_exterior' // Ulkoseinä (hirsi, lauta, kivi, rappaus, levy)
  | 'wall_interior' // Sisäseinä (tapetti, maali, levy, laatta)
  | 'paint' // Maali (värikoodi, valmistaja, tuote, pinta)
  | 'window' // Ikkuna
  | 'door' // Ovi
  | 'other' // Muu

export interface BuildingMaterial {
  id: number
  property_id: number
  category: MaterialCategory // Materiaalikategoria
  location: string // Sijainti kiinteistössä, esim. "Olohuone", "Katto yleinen"
  material: string // Materiaali tai tuotenimi, esim. "Koivu parketti 14mm"
  manufacturer: string // Valmistaja, esim. "Karelia", "Teknos"
  color_code: string // Värikoodi, esim. "NCS S 0500-N" tai "Punainen RR29"
  applied_date: string // Asennus-/maalauspäivämäärä (YYYY-MM-DD tai tyhjä)
  notes: string // Vapaat huomiot: määrät, ostopaikka, takuu jne.
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
  | 'building_materials'
