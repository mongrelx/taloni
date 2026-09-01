import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
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
