import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isIsoDate, isIsoMonth, isKiinteistotunnus, isNonNegativeNumber,
  parseAmount, isPriority, isTxType, validateTaskInput, validateTransactionInput
} from '../src/validate.ts'

test('isIsoDate accepts valid dates and rejects invalid ones', () => {
  assert.equal(isIsoDate('2026-06-15'), true)
  assert.equal(isIsoDate('2026-13-40'), false) // kuukausi/päivä ei kelpaa
  assert.equal(isIsoDate('2026-02-30'), false) // ei olemassa
  assert.equal(isIsoDate('26-6-1'), false)
  assert.equal(isIsoDate(''), false)
})

test('isIsoMonth validates YYYY-MM', () => {
  assert.equal(isIsoMonth('2026-05'), true)
  assert.equal(isIsoMonth('2026-00'), false)
  assert.equal(isIsoMonth('2026-13'), false)
  assert.equal(isIsoMonth('2026-5'), false)
})

test('isKiinteistotunnus matches Finnish property id format', () => {
  assert.equal(isKiinteistotunnus('405-412-1-23'), true)
  assert.equal(isKiinteistotunnus('837-112-2-45'), true)
  assert.equal(isKiinteistotunnus('405-412-1'), false)
  assert.equal(isKiinteistotunnus('abc'), false)
})

test('isNonNegativeNumber and parseAmount', () => {
  assert.equal(isNonNegativeNumber(0), true)
  assert.equal(isNonNegativeNumber(-1), false)
  assert.equal(isNonNegativeNumber(Infinity), false)
  assert.equal(parseAmount('12.50'), 12.5)
  assert.equal(parseAmount('-5'), null)
  assert.equal(parseAmount('abc'), null)
})

test('enum guards', () => {
  assert.equal(isPriority('high'), true)
  assert.equal(isPriority('urgent'), false)
  assert.equal(isTxType('income'), true)
  assert.equal(isTxType('gift'), false)
})

test('validateTaskInput collects errors', () => {
  assert.deepEqual(validateTaskInput({ title: 'Nuohous', priority: 'high', cost: '65' }), [])
  const errs = validateTaskInput({ title: '', priority: 'urgent', cost: '-5' })
  assert.equal(errs.length, 3)
})

test('validateTransactionInput collects errors', () => {
  assert.deepEqual(validateTransactionInput({ amount: '650', type: 'income' }), [])
  const errs = validateTransactionInput({ amount: 'x', type: 'gift' })
  assert.equal(errs.length, 2)
})
