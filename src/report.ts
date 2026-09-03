// Raportointi & vienti — vuosikooste, vuokratuloraportti (verottajalle) ja CSV-vienti.
import {
  getBookings,
  getBuildingMaterials,
  getProperties,
  getTasks,
  getTransactions,
  getUtilities,
  type Transaction,
} from './db/index.js'

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
