#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { render } from 'ink'
import React from 'react'
import {
  addTask,
  addTransaction,
  getDbPath,
  getProperties,
  getRenovations,
  getTasks,
  initDb,
} from './db/index.js'
import {
  annualReport,
  buildCsvExports,
  buildJsonExport,
  formatAnnualReport,
  formatPortfolioReport,
  formatRenovationBudgetReport,
  formatRentalReport,
  type ImportResult,
  importPropertiesCsv,
  importTransactionsCsv,
  portfolioReport,
  renovationBudgetReport,
  rentalIncomeReport,
} from './report.js'
import { Dashboard } from './ui/Dashboard.js'
import {
  parseAmount,
  validateTaskInput,
  validateTransactionInput,
} from './validate.js'

// 1. Node Version Guard
const [major, minor] = process.versions.node.split('.').map(Number)
if (
  major === undefined ||
  major < 22 ||
  (major === 22 && minor !== undefined && minor < 5)
) {
  process.stderr.write(
    `Error: taloni requires Node.js >= 22.5.0 for native SQLite support (current: ${process.version})\n`,
  )
  process.exit(1)
}

// 2. Initialize Database
try {
  initDb()
} catch (e) {
  process.stderr.write(
    `Failed to initialize SQLite database: ${(e as Error).message}\n`,
  )
  process.exit(1)
}

// 3. Define Commander CLI
const program = new Command()

program
  .name('taloni')
  .description(
    'Beautiful localized terminal dashboard for managing Finnish log houses & property registries.',
  )
  .version('1.1.0')

// Default action: start interactive dashboard TUI
program.action(() => {
  // Clear screen first for a clean TUI experience
  process.stdout.write('\x1Bc')

  // Start Ink render
  const app = render(React.createElement(Dashboard))

  // Wait for Ink app to complete
  app.waitUntilExit().then(() => {
    process.stdout.write('\nHei hei! Thank you for using Taloni!\n')
  })
})

// Command: list properties (Kiinteistöluettelo)
program
  .command('properties')
  .description('List all Finnish properties and kiinteistötunnus records')
  .action(() => {
    const props = getProperties()
    console.log('\n--- 🏡 KIINTEISTÖREKISTERI (Property Registry) ---')
    props.forEach((p) => {
      const waterLabel =
        p.water_source === 'well'
          ? 'Oma kaivo (Well)'
          : 'Kunnan vesiliittymä (Mains)'
      console.log(`[ID: ${p.id}] ${p.name}`)
      console.log(`  └─ Tunnus:  ${p.kiinteistotunnus}`)
      console.log(`  └─ Vesi:    ${waterLabel}`)
      console.log(`  └─ Vuosi:   ${p.build_year}`)
      console.log(`  └─ Sijainti: ${p.location}\n`)
    })
  })

// Command: add-task
program
  .command('add-task')
  .description('Add a task for a specific property')
  .argument('<title>', 'Task title')
  .option(
    '-p, --priority <priority>',
    'Priority: low, medium, or high',
    'medium',
  )
  .option(
    '-c, --category <category>',
    'Category (e.g. Garden, Tools, Maintenance)',
    'General',
  )
  .option('-s, --cost <cost>', 'Estimated cost in EUR', '0')
  .option(
    '-i, --property-id <id>',
    'Target Property ID (Default: 1 - Metsäpirtti)',
    '1',
  )
  .action((title, options) => {
    const errors = validateTaskInput({
      title,
      priority: options.priority,
      cost: options.cost,
    })
    if (errors.length > 0) {
      process.stderr.write(
        `Virheellinen syöte:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`,
      )
      process.exit(1)
    }
    const costNum = parseAmount(options.cost) ?? 0
    const propId = parseInt(options.propertyId, 10) || 1

    addTask({
      property_id: propId,
      title,
      status: 'pending',
      priority: options.priority as 'low' | 'medium' | 'high',
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0], // 14 days out
      category: options.category,
      cost: costNum,
      recurrence: 'none',
      next_due: null,
    })

    const props = getProperties()
    const propName =
      props.find((p) => p.id === propId)?.name || `Property #${propId}`
    console.log(
      `Successfully added task to "${propName}":\n"${title}" [${options.priority.toUpperCase()}] €${costNum}`,
    )
  })

// Command: add-tx (add income or expense)
program
  .command('add-tx')
  .description('Add a financial transaction (income or expense)')
  .argument('<amount>', 'Amount in EUR (positive number)')
  .option('-t, --type <type>', 'Transaction type: income or expense', 'expense')
  .option(
    '-c, --category <category>',
    'Category (e.g. Rent, Wood, Electric, Tools)',
    'General',
  )
  .option('-d, --desc <description>', 'Description', 'Transaction')
  .option(
    '-i, --property-id <id>',
    'Target Property ID (Default: 1 - Metsäpirtti)',
    '1',
  )
  .option(
    '-r, --renovation-id <id>',
    'Link this expense to a renovation project ID',
  )
  .action((amountStr, options) => {
    const errors = validateTransactionInput({
      amount: amountStr,
      type: options.type,
    })
    if (errors.length > 0) {
      process.stderr.write(
        `Virheellinen syöte:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`,
      )
      process.exit(1)
    }
    const amt = parseAmount(amountStr) ?? 0
    const propId = parseInt(options.propertyId, 10) || 1
    let renovationId: number | null = null
    if (options.renovationId !== undefined) {
      renovationId = parseInt(options.renovationId, 10)
      if (
        Number.isNaN(renovationId) ||
        !getRenovations().some((r) => r.id === renovationId)
      ) {
        process.stderr.write(
          `Virheellinen syöte:\n  - Tuntematon renovation-id: ${options.renovationId}\n`,
        )
        process.exit(1)
      }
    }

    addTransaction({
      property_id: propId,
      type: options.type as 'income' | 'expense',
      category: options.category,
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      description: options.desc,
      renovation_id: renovationId,
    })

    const props = getProperties()
    const propName =
      props.find((p) => p.id === propId)?.name || `Property #${propId}`
    const symbol = options.type === 'income' ? '+' : '-'
    console.log(
      `Successfully recorded financial entry for "${propName}": ${options.type.toUpperCase()} ${symbol}${amt} € (${options.desc})`,
    )
  })

// Command: list tasks
program
  .command('list')
  .description('Print all tasks to the terminal')
  .option('-i, --property-id <id>', 'Filter by Property ID')
  .action((options) => {
    const propId = options.propertyId
      ? parseInt(options.propertyId, 10)
      : undefined
    const tasks = getTasks(propId)
    const props = getProperties()

    if (tasks.length === 0) {
      console.log('No tasks found.')
      return
    }

    console.log('\n--- 📋 TEHTÄVÄLISTA (Tasks List) ---')
    tasks.forEach((t) => {
      const statusIcon =
        t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '➔' : '☐'
      const propName =
        props.find((p) => p.id === t.property_id)?.name ||
        `Prop #${t.property_id}`
      console.log(
        `${statusIcon} [${t.priority.toUpperCase()}] ${t.title} [${propName}] (${t.category}) - ${t.cost} €`,
      )
    })
    console.log('')
  })

// Command: report — vuosikooste ja vuokratuloraportti (verottajalle)
program
  .command('report')
  .description('Print annual summary and rental-income report (for taxes)')
  .argument('[year]', 'Report year (default: current year)')
  .option('--rental-only', 'Print only the rental-income report')
  .action((yearArg, options) => {
    const year = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear()
    if (Number.isNaN(year)) {
      process.stderr.write(`Virheellinen vuosi: ${yearArg}\n`)
      process.exit(1)
    }
    if (!options.rentalOnly) {
      console.log(formatAnnualReport(annualReport(year)))
      console.log('')
    }
    console.log(formatRentalReport(rentalIncomeReport(year)))
  })

// Command: portfolio — kohteiden salkkuvertailu (kulut, tehtävät, käyttöaste, ROI)
program
  .command('portfolio')
  .description('Print side-by-side property portfolio comparison')
  .argument('[year]', 'Report year (default: current year)')
  .action((yearArg) => {
    const year = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear()
    if (Number.isNaN(year)) {
      process.stderr.write(`Virheellinen vuosi: ${yearArg}\n`)
      process.exit(1)
    }
    console.log(formatPortfolioReport(portfolioReport(year)))
  })

// Command: renovations — remonttien budjetti vs. toteutunut -vertailu
program
  .command('renovations')
  .description('Print renovation budget-vs-actual comparison')
  .action(() => {
    console.log(formatRenovationBudgetReport(renovationBudgetReport()))
  })

// Command: export — kirjoittaa taulukot CSV-tiedostoiksi
program
  .command('export')
  .description('Export tables to CSV files')
  .argument('[dir]', 'Target directory (default: ./taloni-export)')
  .action((dirArg) => {
    const dir = dirArg || join(process.cwd(), 'taloni-export')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const files = buildCsvExports()
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content, 'utf8')
    }
    console.log(
      `Vienti valmis: ${Object.keys(files).length} CSV-tiedostoa hakemistoon ${dir}`,
    )
    for (const f of Object.keys(files)) {
      console.log(`  - ${f}`)
    }
  })

// Command: export-json — koko tietokannan vienti yhteen JSON-tiedostoon
program
  .command('export-json')
  .description('Export the full database as a single JSON file')
  .argument('[file]', 'Target file (default: ./taloni-export.json)')
  .action((fileArg) => {
    const file = fileArg || join(process.cwd(), 'taloni-export.json')
    writeFileSync(file, JSON.stringify(buildJsonExport(), null, 2), 'utf8')
    console.log(`JSON-vienti valmis: ${file}`)
  })

// Command: import — tuo kiinteistöjä tai taloustapahtumia CSV-tiedostosta
program
  .command('import')
  .description(
    'Import properties or transactions from a CSV file (columns match `export`)',
  )
  .argument('<type>', 'Data type: properties|transactions')
  .argument('<file>', 'Path to the CSV file')
  .action((type, file) => {
    if (type !== 'properties' && type !== 'transactions') {
      process.stderr.write(
        `Tuntematon tyyppi: ${type} (odotettu: properties|transactions)\n`,
      )
      process.exit(1)
    }
    if (!existsSync(file)) {
      process.stderr.write(`Tiedostoa ei löytynyt: ${file}\n`)
      process.exit(1)
    }
    const csvText = readFileSync(file, 'utf8')
    const result: ImportResult =
      type === 'properties'
        ? importPropertiesCsv(csvText)
        : importTransactionsCsv(csvText)
    console.log(`Tuotu ${result.imported} riviä.`)
    if (result.errors.length > 0) {
      console.log(`${result.errors.length} riviä hylättiin:`)
      for (const e of result.errors) console.log(`  - ${e}`)
    }
    if (result.imported === 0 && result.errors.length > 0) process.exit(1)
  })

// Command: backup — varmuuskopioi SQLite-tietokannan aikaleimatulla nimellä
program
  .command('backup')
  .description('Back up the SQLite database to a timestamped file')
  .argument('[dir]', 'Backup directory (default: ~/.taloni/backups)')
  .action((dirArg) => {
    const src = getDbPath()
    if (!existsSync(src)) {
      process.stderr.write(`Tietokantaa ei löytynyt: ${src}\n`)
      process.exit(1)
    }
    const dir = dirArg || join(process.env.HOME || '.', '.taloni', 'backups')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    // Aikaleima YYYYMMDD-HHMMSS
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const dest = join(dir, `estate-${stamp}.db`)
    copyFileSync(src, dest)
    console.log(`Varmuuskopio luotu: ${dest}`)
  })

program.parse(process.argv)
