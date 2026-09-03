// Raportointi & vienti — vuosikooste, vuokratuloraportti (verottajalle), CSV/JSON-vienti ja -tuonti.
import {
  addProperty,
  addTransaction,
  assessEnergyEfficiency,
  getBookings,
  getBuildingMaterials,
  getContacts,
  getDocuments,
  getFireplaces,
  getFirewood,
  getHeatingSystems,
  getInsurance,
  getMeterReadings,
  getProperties,
  getRenovations,
  getTasks,
  getTools,
  getTransactions,
  getUtilities,
  getWastewaterSystems,
  getWaterTests,
  type Property,
  type Transaction,
} from './db/index.js'
import { isIsoDate, isKiinteistotunnus, parseAmount } from './validate.js'

export interface PropertyYearSummary {
  propertyId: number
  name: string
  income: number
  expense: number
  net: number
}

export interface AnnualReport {
  year: number
  totalIncome: number
  totalExpense: number
  net: number
  byProperty: PropertyYearSummary[]
  byCategory: { category: string; type: Transaction['type']; total: number }[]
}

function inYear(dateStr: string, year: number): boolean {
  return typeof dateStr === 'string' && dateStr.startsWith(`${year}-`)
}

// Vuosikooste: tulot, menot ja nettotulos kohteittain ja kategorioittain.
export function annualReport(year: number): AnnualReport {
  const props = getProperties()
  const txs = getTransactions().filter((t) => inYear(t.date, year))

  const byProperty: PropertyYearSummary[] = props.map((p) => {
    const pTxs = txs.filter((t) => t.property_id === p.id)
    const income = pTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const expense = pTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return {
      propertyId: p.id,
      name: p.name,
      income,
      expense,
      net: income - expense,
    }
  })

  const catMap = new Map<
    string,
    { category: string; type: Transaction['type']; total: number }
  >()
  for (const t of txs) {
    const key = `${t.type}:${t.category}`
    const cur = catMap.get(key) ?? {
      category: t.category,
      type: t.type,
      total: 0,
    }
    cur.total += t.amount
    catMap.set(key, cur)
  }

  const totalIncome = byProperty.reduce((s, p) => s + p.income, 0)
  const totalExpense = byProperty.reduce((s, p) => s + p.expense, 0)
  return {
    year,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    byProperty,
    byCategory: [...catMap.values()].sort((a, b) => b.total - a.total),
  }
}

export interface PortfolioRow {
  propertyId: number
  name: string
  kiinteistotunnus: string
  income: number // Vuoden tulot
  expense: number // Vuoden menot
  net: number
  openTasks: number // Tehtäviä, joita ei ole merkitty valmiiksi (nykytila)
  overdueTasks: number // Avoimia tehtäviä, joiden eräpäivä on ohitettu (nykytila)
  nights: number // Vuokrausöitä valitulta vuodelta (ei-perutut varaukset)
  occupancyRate: number // Vuokrausöiden osuus vuoden päivistä, %
  roi: number | null // Nettotulos suhteessa menoihin, % (null jos ei menoja)
}

export interface PortfolioReport {
  year: number
  rows: PortfolioRow[]
  totals: {
    income: number
    expense: number
    net: number
    nights: number
    occupancyRate: number
  }
}

function daysInYear(year: number): number {
  return Math.round(
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000,
  )
}

// Salkkuvertailu: kohteiden vertailu rinnakkain (kulut, tehtävät, käyttöaste, ROI).
// "Property value tracking over time" -kohta (issue #28) on jätetty pois — kiinteistön
// arvolle ei ole vielä tietolähdettä/skeemaa, eikä sitä ole tarkemmin määritelty.
export function portfolioReport(year: number): PortfolioReport {
  const props = getProperties()
  const txs = getTransactions().filter((t) => inYear(t.date, year))
  const allTasks = getTasks()
  const todayIso = new Date().toISOString().slice(0, 10)
  const bookings = getBookings().filter(
    (b) => inYear(b.start_date, year) && b.status !== 'cancelled',
  )
  const yearDays = daysInYear(year)

  const rows: PortfolioRow[] = props.map((p) => {
    const pTxs = txs.filter((t) => t.property_id === p.id)
    const income = pTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const expense = pTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    const net = income - expense

    const pTasks = allTasks.filter((t) => t.property_id === p.id)
    const openTasks = pTasks.filter((t) => t.status !== 'completed').length
    const overdueTasks = pTasks.filter(
      (t) => t.status !== 'completed' && t.due_date < todayIso,
    ).length

    const nights = bookings
      .filter((b) => b.property_id === p.id)
      .reduce((s, b) => {
        const ms =
          new Date(`${b.end_date}T00:00:00Z`).getTime() -
          new Date(`${b.start_date}T00:00:00Z`).getTime()
        return s + Math.max(0, Math.round(ms / 86_400_000))
      }, 0)

    return {
      propertyId: p.id,
      name: p.name,
      kiinteistotunnus: p.kiinteistotunnus,
      income,
      expense,
      net,
      openTasks,
      overdueTasks,
      nights,
      occupancyRate: (nights / yearDays) * 100,
      roi: expense > 0 ? (net / expense) * 100 : null,
    }
  })

  const totalIncome = rows.reduce((s, r) => s + r.income, 0)
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0)
  const totalNights = rows.reduce((s, r) => s + r.nights, 0)

  return {
    year,
    rows,
    totals: {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      nights: totalNights,
      occupancyRate:
        rows.length > 0 ? (totalNights / (rows.length * yearDays)) * 100 : 0,
    },
  }
}

export interface RentalReportRow {
  propertyId: number
  name: string
  kiinteistotunnus: string
  rentalIncome: number // Vuokratulot taloustapahtumista (kategoria "Vuokraus")
  nights: number // Vuokrausyöt varauksista (ei-perutut)
}

export interface RentalReport {
  year: number
  rows: RentalReportRow[]
  total: number
}

// Vuokratuloraportti verottajalle: vuokratulot ja -yöt kohteittain valitulta vuodelta.
export function rentalIncomeReport(year: number): RentalReport {
  const props = getProperties()
  const txs = getTransactions().filter(
    (t) =>
      inYear(t.date, year) && t.type === 'income' && t.category === 'Vuokraus',
  )
  const bookings = getBookings().filter(
    (b) => inYear(b.start_date, year) && b.status !== 'cancelled',
  )

  const rows: RentalReportRow[] = props
    .map((p) => {
      const rentalIncome = txs
        .filter((t) => t.property_id === p.id)
        .reduce((s, t) => s + t.amount, 0)
      const nights = bookings
        .filter((b) => b.property_id === p.id)
        .reduce((s, b) => {
          const ms =
            new Date(`${b.end_date}T00:00:00Z`).getTime() -
            new Date(`${b.start_date}T00:00:00Z`).getTime()
          return s + Math.max(0, Math.round(ms / 86_400_000))
        }, 0)
      return {
        propertyId: p.id,
        name: p.name,
        kiinteistotunnus: p.kiinteistotunnus,
        rentalIncome,
        nights,
      }
    })
    .filter((r) => r.rentalIncome > 0 || r.nights > 0)

  return { year, rows, total: rows.reduce((s, r) => s + r.rentalIncome, 0) }
}

export interface RenovationBudgetRow {
  renovationId: number
  projectName: string
  propertyName: string
  status: 'planning' | 'in_progress' | 'completed'
  budget: number
  spent: number // Käsin syötetty toteutunut kustannus (renovations.spent)
  linkedExpenses: number // Linkitettyjen taloustapahtumien summa (transactions.renovation_id)
  variance: number // budget - spent (negatiivinen = ylitys)
  overBudget: boolean
}

// Budjetti vs. toteutunut -vertailu remonttiprojekteittain. `spent` on käsin syötetty
// kokonaiskustannus; `linkedExpenses` on ristiintarkistus transactions.renovation_id-
// linkityksen kautta kirjatuista kuluista (issue #25: "Link expenses to specific
// renovation projects"). "Cost estimates per material + labor" ja "Historical cost
// data" on jätetty pois — vaativat oman skeeman, eikä niitä ole tarkemmin määritelty.
export function renovationBudgetReport(): RenovationBudgetRow[] {
  const props = getProperties()
  const txs = getTransactions()
  return getRenovations().map((r) => {
    const linkedExpenses = txs
      .filter((t) => t.renovation_id === r.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return {
      renovationId: r.id,
      projectName: r.project_name,
      propertyName:
        props.find((p) => p.id === r.property_id)?.name ||
        `Kohde #${r.property_id}`,
      status: r.status,
      budget: r.budget,
      spent: r.spent,
      linkedExpenses,
      variance: r.budget - r.spent,
      overBudget: r.spent > r.budget,
    }
  })
}

export interface EnergyReportRow {
  propertyId: number
  name: string
  floorArea: number // m², 0 = ei tiedossa
  energyRating: string // '' = ei energiatodistusta
  electricConsumptionKwh: number // Vuoden aikana mitattu kulutus (mittarilukemien erotus)
  kwhPerM2: number | null // null jos pinta-alaa ei tiedetä
  suggestions: string[]
}

// Laskee vuoden aikana mitatun sähkönkulutuksen mittarilukemien peräkkäisistä eroista
// (sama logiikka kuin Dashboard.tsx:n mittarilukemat-välilehden kulutustrendi).
function yearlyElectricConsumption(propertyId: number, year: number): number {
  const readings = getMeterReadings(propertyId)
    .filter((r) => r.meter_type === 'electric')
    .sort((a, b) => a.reading_date.localeCompare(b.reading_date))
  let total = 0
  for (let i = 1; i < readings.length; i++) {
    if (inYear(readings[i]!.reading_date, year)) {
      const delta = readings[i]!.reading - readings[i - 1]!.reading
      if (delta > 0) total += delta
    }
  }
  return total
}

// Energiatehokkuusraportti: mitattu sähkönkulutus kWh/m²/v (jos pinta-ala tiedossa) sekä
// informatiiviset parannusehdotukset. "Insulation tracking per building component" on jo
// katettu building_materials-taulun wall_exterior/wall_interior-kategorioilla (Vaihe-osio),
// joten sitä ei toisteta tässä erikseen.
export function energyEfficiencyReport(year: number): EnergyReportRow[] {
  const heating = getHeatingSystems()
  return getProperties().map((p) => {
    const consumption = yearlyElectricConsumption(p.id, year)
    const propHeating = heating.filter((h) => h.property_id === p.id)
    return {
      propertyId: p.id,
      name: p.name,
      floorArea: p.floor_area,
      energyRating: p.energy_rating,
      electricConsumptionKwh: consumption,
      kwhPerM2: p.floor_area > 0 ? consumption / p.floor_area : null,
      suggestions: assessEnergyEfficiency(p, propHeating).suggestions,
    }
  })
}

// --- CSV ---

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Muuntaa oliolistan CSV-merkkijonoksi. Otsikkorivi tulee annetuista sarakkeista
// (oletuksena ensimmäisen rivin avaimet).
export function toCSV(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0) return columns ? `${columns.join(',')}\n` : ''
  const cols = columns ?? Object.keys(rows[0]!)
  const header = cols.join(',')
  const body = rows
    .map((r) => cols.map((c) => csvCell(r[c])).join(','))
    .join('\n')
  return `${header}\n${body}\n`
}

// Kokoaa vientiin menevät taulukot CSV-muodossa (tiedostonimi → sisältö).
export function buildCsvExports(): Record<string, string> {
  return {
    'transactions.csv': toCSV(
      getTransactions() as unknown as Record<string, unknown>[],
    ),
    'utilities.csv': toCSV(
      getUtilities() as unknown as Record<string, unknown>[],
    ),
    'bookings.csv': toCSV(
      getBookings() as unknown as Record<string, unknown>[],
    ),
    'tasks.csv': toCSV(getTasks() as unknown as Record<string, unknown>[]),
    'properties.csv': toCSV(
      getProperties() as unknown as Record<string, unknown>[],
    ),
    'building_materials.csv': toCSV(
      getBuildingMaterials() as unknown as Record<string, unknown>[],
    ),
  }
}

// Jäsentää CSV-tekstin (toCSV:n käänteisoperaatio) rivien objektilistaksi otsikkorivin mukaan.
// Tukee lainausmerkeissä olevia kenttiä, joissa on pilkkuja, rivinvaihtoja tai "" -paritettuja lainausmerkkejä.
export function fromCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  if (rows.length === 0) return []
  const header = rows[0]!
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? ''
    })
    return obj
  })
}

export interface ImportResult {
  imported: number
  errors: string[] // "Rivi N: syy" -muotoiset virheet hylätyille riveille
}

// Tuo kiinteistöjä CSV:stä (sarakkeet: ks. properties.csv-vientimuoto, id-sarake ohitetaan).
export function importPropertiesCsv(csvText: string): ImportResult {
  const rows = fromCSV(csvText)
  const errors: string[] = []
  let imported = 0
  const SAUNA_TYPES = new Set(['none', 'wood', 'electric'])
  const BIOWASTE_TYPES = new Set([
    'collection',
    'home_compost',
    'shared',
    'none',
  ])
  const ENERGY_RATINGS = new Set(['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'])

  rows.forEach((row, idx) => {
    const lineNo = idx + 2
    const name = (row.name ?? '').trim()
    const kiinteistotunnus = (row.kiinteistotunnus ?? '').trim()
    const waterSource = row.water_source
    const buildYear = Number(row.build_year)

    if (!name) {
      errors.push(`Rivi ${lineNo}: nimi puuttuu`)
      return
    }
    if (!isKiinteistotunnus(kiinteistotunnus)) {
      errors.push(
        `Rivi ${lineNo}: virheellinen kiinteistötunnus (${row.kiinteistotunnus})`,
      )
      return
    }
    if (waterSource !== 'well' && waterSource !== 'mains') {
      errors.push(
        `Rivi ${lineNo}: water_source tulee olla well|mains (oli: ${waterSource})`,
      )
      return
    }
    if (!Number.isFinite(buildYear) || buildYear <= 0) {
      errors.push(`Rivi ${lineNo}: virheellinen build_year (${row.build_year})`)
      return
    }

    const saunaType = SAUNA_TYPES.has(row.sauna_type ?? '')
      ? (row.sauna_type as Property['sauna_type'])
      : 'none'
    const biowaste = BIOWASTE_TYPES.has(row.biowaste ?? '')
      ? (row.biowaste as Property['biowaste'])
      : 'collection'
    const energyRating = ENERGY_RATINGS.has(row.energy_rating ?? '')
      ? (row.energy_rating as Property['energy_rating'])
      : ''

    addProperty({
      name,
      kiinteistotunnus,
      water_source: waterSource,
      build_year: buildYear,
      location: row.location ?? '',
      sauna_type: saunaType,
      sauna_info: row.sauna_info ?? '',
      property_tax: parseAmount(row.property_tax ?? '') ?? 0,
      road_fee: parseAmount(row.road_fee ?? '') ?? 0,
      electricity_fuse: row.electricity_fuse ?? '',
      water_connection: row.water_connection ?? '',
      waste_provider: row.waste_provider ?? '',
      waste_bin: row.waste_bin ?? '',
      waste_interval: row.waste_interval ?? '',
      biowaste,
      compost_registered: row.compost_registered === '1' ? 1 : 0,
      compost_reg_date: row.compost_reg_date ?? '',
      floor_area: parseAmount(row.floor_area ?? '') ?? 0,
      energy_rating: energyRating,
      energy_cert_date: row.energy_cert_date ?? '',
      energy_cert_valid_until: row.energy_cert_valid_until ?? '',
    })
    imported++
  })

  return { imported, errors }
}

// Tuo taloustapahtumia CSV:stä (sarakkeet: property_id, type, category, amount, date, description,
// valinnainen renovation_id remonttiprojektiin linkitystä varten).
export function importTransactionsCsv(csvText: string): ImportResult {
  const rows = fromCSV(csvText)
  const validPropertyIds = new Set(getProperties().map((p) => p.id))
  const validRenovationIds = new Set(getRenovations().map((r) => r.id))
  const errors: string[] = []
  let imported = 0

  rows.forEach((row, idx) => {
    const lineNo = idx + 2
    const propertyId = Number(row.property_id)
    const amount = parseAmount(row.amount ?? '')
    const type = row.type
    const date = row.date ?? ''

    if (!Number.isFinite(propertyId) || !validPropertyIds.has(propertyId)) {
      errors.push(`Rivi ${lineNo}: tuntematon property_id (${row.property_id})`)
      return
    }
    if (type !== 'income' && type !== 'expense') {
      errors.push(
        `Rivi ${lineNo}: type tulee olla income|expense (oli: ${type})`,
      )
      return
    }
    if (amount === null) {
      errors.push(`Rivi ${lineNo}: virheellinen amount (${row.amount})`)
      return
    }
    if (!isIsoDate(date)) {
      errors.push(`Rivi ${lineNo}: virheellinen date (${row.date})`)
      return
    }
    const renovationIdRaw = (row.renovation_id ?? '').trim()
    let renovationId: number | null = null
    if (renovationIdRaw) {
      const parsed = Number(renovationIdRaw)
      if (!Number.isFinite(parsed) || !validRenovationIds.has(parsed)) {
        errors.push(
          `Rivi ${lineNo}: tuntematon renovation_id (${renovationIdRaw})`,
        )
        return
      }
      renovationId = parsed
    }

    addTransaction({
      property_id: propertyId,
      type,
      category: row.category ?? '',
      amount,
      date,
      description: row.description ?? '',
      renovation_id: renovationId,
    })
    imported++
  })

  return { imported, errors }
}

// Koko tietokannan vienti yhdeksi JSON-oliokoosteeksi (kaikki taulut).
export function buildJsonExport(): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    properties: getProperties(),
    tasks: getTasks(),
    renovations: getRenovations(),
    transactions: getTransactions(),
    utilities: getUtilities(),
    tools: getTools(),
    insurance: getInsurance(),
    heatingSystems: getHeatingSystems(),
    fireplaces: getFireplaces(),
    wastewaterSystems: getWastewaterSystems(),
    waterTests: getWaterTests(),
    firewood: getFirewood(),
    bookings: getBookings(),
    contacts: getContacts(),
    documents: getDocuments(),
    meterReadings: getMeterReadings(),
    buildingMaterials: getBuildingMaterials(),
  }
}

// --- Tekstiraportit ---

const eur = (n: number) => `${n.toFixed(2)} €`

export function formatAnnualReport(r: AnnualReport): string {
  const lines: string[] = []
  lines.push(`=== VUOSIKOOSTE ${r.year} ===`)
  lines.push('')
  lines.push('Kohteittain:')
  for (const p of r.byProperty) {
    lines.push(
      `  ${p.name.padEnd(16)} tulot ${eur(p.income).padStart(12)} | menot ${eur(p.expense).padStart(12)} | netto ${eur(p.net).padStart(12)}`,
    )
  }
  lines.push('')
  lines.push('Kategorioittain:')
  for (const c of r.byCategory) {
    const label = c.type === 'income' ? 'TULO ' : 'MENO '
    lines.push(
      `  ${label}${c.category.padEnd(16)} ${eur(c.total).padStart(12)}`,
    )
  }
  lines.push('')
  lines.push(
    `YHTEENSÄ  tulot ${eur(r.totalIncome)} | menot ${eur(r.totalExpense)} | NETTOTULOS ${eur(r.net)}`,
  )
  return lines.join('\n')
}

export function formatPortfolioReport(r: PortfolioReport): string {
  const lines: string[] = []
  lines.push(`=== SALKKUVERTAILU ${r.year} ===`)
  lines.push('')
  if (r.rows.length === 0) {
    lines.push('Ei kiinteistöjä.')
    return lines.join('\n')
  }
  for (const row of r.rows) {
    const roiStr = row.roi === null ? '—' : `${row.roi.toFixed(1)} %`
    lines.push(`  ${row.name} (${row.kiinteistotunnus})`)
    lines.push(
      `    Tulot ${eur(row.income).padStart(12)} | Menot ${eur(row.expense).padStart(12)} | Netto ${eur(row.net).padStart(12)} | ROI ${roiStr}`,
    )
    lines.push(
      `    Tehtäviä avoinna: ${row.openTasks} (${row.overdueTasks} myöhässä) | Käyttöaste: ${row.occupancyRate.toFixed(1)} % (${row.nights} yötä)`,
    )
  }
  lines.push('')
  lines.push(
    `YHTEENSÄ  tulot ${eur(r.totals.income)} | menot ${eur(r.totals.expense)} | netto ${eur(r.totals.net)} | käyttöaste ${r.totals.occupancyRate.toFixed(1)} % (${r.totals.nights} yötä)`,
  )
  return lines.join('\n')
}

export function formatRentalReport(r: RentalReport): string {
  const lines: string[] = []
  lines.push(`=== VUOKRATULORAPORTTI ${r.year} (verottajalle) ===`)
  lines.push('')
  if (r.rows.length === 0) {
    lines.push('Ei vuokratuloja tältä vuodelta.')
  } else {
    for (const row of r.rows) {
      lines.push(
        `  ${row.name.padEnd(16)} (${row.kiinteistotunnus.padEnd(14)}) vuokratulot ${eur(row.rentalIncome).padStart(12)} | ${row.nights} yötä`,
      )
    }
    lines.push('')
    lines.push(`VUOKRATULOT YHTEENSÄ: ${eur(r.total)}`)
  }
  return lines.join('\n')
}

export function formatRenovationBudgetReport(
  rows: RenovationBudgetRow[],
): string {
  const lines: string[] = []
  lines.push('=== REMONTTIEN BUDJETTI VS. TOTEUTUNUT ===')
  lines.push('')
  if (rows.length === 0) {
    lines.push('Ei remonttiprojekteja.')
    return lines.join('\n')
  }
  for (const row of rows) {
    const flag = row.overBudget ? ' ⚠ YLITYS' : ''
    lines.push(
      `  ${row.projectName} (${row.propertyName}) [${row.status}]${flag}`,
    )
    lines.push(
      `    Budjetti ${eur(row.budget).padStart(12)} | Toteutunut ${eur(row.spent).padStart(12)} | Erotus ${eur(row.variance).padStart(12)}`,
    )
    if (row.linkedExpenses > 0) {
      lines.push(`    Linkitetyt taloustapahtumat: ${eur(row.linkedExpenses)}`)
    }
  }
  return lines.join('\n')
}

export function formatEnergyReport(
  rows: EnergyReportRow[],
  year: number,
): string {
  const lines: string[] = []
  lines.push(`=== ENERGIATEHOKKUUS ${year} ===`)
  lines.push('')
  for (const row of rows) {
    const rating = row.energyRating || '—'
    const perM2 =
      row.kwhPerM2 === null
        ? 'ei tiedossa (pinta-ala puuttuu)'
        : `${row.kwhPerM2.toFixed(1)} kWh/m²/v`
    lines.push(`  ${row.name} [Energialuokka: ${rating}]`)
    lines.push(
      `    Sähkönkulutus ${row.electricConsumptionKwh} kWh | ${perM2} | Pinta-ala: ${row.floorArea || '—'} m²`,
    )
    for (const s of row.suggestions) {
      lines.push(`    💡 ${s}`)
    }
  }
  lines.push('')
  lines.push(
    'Huom: parannusehdotukset ovat informatiivisia yleissuosituksia, eivät asiantuntija-arvio.',
  )
  return lines.join('\n')
}
