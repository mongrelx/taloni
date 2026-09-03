import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const testHome = mkdtempSync(join(tmpdir(), 'taloni-cli-test-'))
const cliPath = join(process.cwd(), 'src/cli.ts')

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliPath, ...args], {
    env: { ...process.env, HOME: testHome },
    encoding: 'utf8',
  })
}

describe('CLI command integration tests', () => {
  it('properties command outputs property registry', () => {
    const res = runCli(['properties'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('KIINTEISTÖREKISTERI'))
    assert.ok(res.stdout.includes('Metsäpirtti'))
    assert.ok(res.stdout.includes('405-412-1-23'))
  })

  it('list command lists tasks', () => {
    const res = runCli(['list'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('TEHTÄVÄLISTA'))
  })

  it('list command with property filter', () => {
    const res = runCli(['list', '-i', '1'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('TEHTÄVÄLISTA'))
  })

  it('add-task adds a task successfully', () => {
    const res = runCli([
      'add-task',
      'Testaa savupiippu',
      '-p',
      'high',
      '-c',
      'Nuohous',
      '-s',
      '80',
      '-i',
      '1',
    ])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Successfully added task'))
    assert.ok(res.stdout.includes('Testaa savupiippu'))

    const listRes = runCli(['list', '-i', '1'])
    assert.ok(listRes.stdout.includes('Testaa savupiippu'))
  })

  it('add-task rejects invalid priority or cost', () => {
    const res = runCli([
      'add-task',
      'Virheellinen',
      '-p',
      'urgent',
      '-s',
      '-10',
    ])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Virheellinen syöte'))
  })

  it('add-tx records income and expense transactions', () => {
    const res = runCli([
      'add-tx',
      '120.50',
      '-t',
      'expense',
      '-c',
      'Sähkö',
      '-d',
      'Tammikuun sähkölasku',
      '-i',
      '1',
    ])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Successfully recorded financial entry'))
    assert.ok(res.stdout.includes('EXPENSE'))
  })

  it('add-tx rejects invalid amount or type', () => {
    const res = runCli(['add-tx', 'not-a-number', '-t', 'invalid-type'])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Virheellinen syöte'))
  })

  it('add-tx links an expense to a renovation project', () => {
    const res = runCli([
      'add-tx',
      '60',
      '-t',
      'expense',
      '-c',
      'Remontti',
      '-i',
      '1',
      '-r',
      '1',
    ])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Successfully recorded financial entry'))
    const renRes = runCli(['renovations'])
    assert.ok(renRes.stdout.includes('Linkitetyt taloustapahtumat'))
  })

  it('add-tx rejects an unknown renovation-id', () => {
    const res = runCli(['add-tx', '60', '-t', 'expense', '-r', '999999'])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Tuntematon renovation-id'))
  })

  it('renovations command prints budget vs actual comparison', () => {
    const res = runCli(['renovations'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('REMONTTIEN BUDJETTI VS. TOTEUTUNUT'))
  })

  it('report command generates annual and rental reports', () => {
    const res = runCli(['report', '2026'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('VUOSIKOOSTE'))
    assert.ok(res.stdout.includes('VUOKRATULORAPORTTI'))
  })

  it('report command with --rental-only flag', () => {
    const res = runCli(['report', '2026', '--rental-only'])
    assert.equal(res.status, 0)
    assert.ok(!res.stdout.includes('VUOSIKOOSTE'))
    assert.ok(res.stdout.includes('VUOKRATULORAPORTTI'))
  })

  it('report rejects invalid year', () => {
    const res = runCli(['report', 'invalid-year'])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Virheellinen vuosi'))
  })

  it('portfolio command prints side-by-side property comparison', () => {
    const res = runCli(['portfolio', '2026'])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('SALKKUVERTAILU'))
    assert.ok(res.stdout.includes('Käyttöaste'))
  })

  it('portfolio rejects invalid year', () => {
    const res = runCli(['portfolio', 'invalid-year'])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Virheellinen vuosi'))
  })

  it('export command creates CSV files in specified directory', () => {
    const exportDir = join(testHome, 'export-test')
    const res = runCli(['export', exportDir])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Vienti valmis'))
    assert.ok(existsSync(join(exportDir, 'properties.csv')))
    assert.ok(existsSync(join(exportDir, 'tasks.csv')))
    assert.ok(existsSync(join(exportDir, 'transactions.csv')))
    const csvContent = readFileSync(join(exportDir, 'properties.csv'), 'utf8')
    assert.ok(csvContent.includes('kiinteistotunnus'))
  })

  it('export-json command writes a full JSON export', () => {
    const jsonFile = join(testHome, 'full-export.json')
    const res = runCli(['export-json', jsonFile])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('JSON-vienti valmis'))
    const data = JSON.parse(readFileSync(jsonFile, 'utf8'))
    assert.ok(Array.isArray(data.properties))
    assert.ok(data.properties.length > 0)
    assert.ok(Array.isArray(data.transactions))
  })

  it('import command adds a property from CSV', () => {
    const csvFile = join(testHome, 'import-properties.csv')
    writeFileSync(
      csvFile,
      'name,kiinteistotunnus,water_source,build_year,location\n' +
        'CLI-tuonti,222-222-2-22,well,2001,Testikylä\n',
    )
    const res = runCli(['import', 'properties', csvFile])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Tuotu 1 riviä'))
    const propsRes = runCli(['properties'])
    assert.ok(propsRes.stdout.includes('CLI-tuonti'))
  })

  it('import command rejects an unknown type', () => {
    const csvFile = join(testHome, 'import-bad.csv')
    writeFileSync(csvFile, 'a,b\n1,2\n')
    const res = runCli(['import', 'bogus', csvFile])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Tuntematon tyyppi'))
  })

  it('import command reports a missing file', () => {
    const res = runCli([
      'import',
      'properties',
      join(testHome, 'does-not-exist.csv'),
    ])
    assert.notEqual(res.status, 0)
    assert.ok(res.stderr.includes('Tiedostoa ei löytynyt'))
  })

  it('backup command creates SQLite backup file', () => {
    const backupDir = join(testHome, 'backups')
    const res = runCli(['backup', backupDir])
    assert.equal(res.status, 0)
    assert.ok(res.stdout.includes('Varmuuskopio luotu'))
    const backupFiles = readdirSync(backupDir)
    assert.ok(
      backupFiles.some((f) => f.startsWith('estate-') && f.endsWith('.db')),
    )
  })
})
