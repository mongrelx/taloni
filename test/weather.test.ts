import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  fetchWeather,
  formatWeather,
  placeFromLocation,
  seasonalAdvice,
  type WeatherReading,
} from '../src/weather.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetch(body: string, ok = true, status = 200) {
  globalThis.fetch = (async () =>
    ({
      ok,
      status,
      text: async () => body,
    }) as Response) as typeof fetch
}

function bsWfsElement(time: string, name: string, value: string): string {
  return `<wfs:member><BsWfs:BsWfsElement><BsWfs:Time>${time}</BsWfs:Time><BsWfs:ParameterName>${name}</BsWfs:ParameterName><BsWfs:ParameterValue>${value}</BsWfs:ParameterValue></BsWfs:BsWfsElement></wfs:member>`
}

test('placeFromLocation strips the country suffix', () => {
  assert.equal(placeFromLocation('Sysmä, Finland'), 'Sysmä')
  assert.equal(placeFromLocation('Tampere, Finland'), 'Tampere')
  assert.equal(placeFromLocation('Helsinki'), 'Helsinki')
})

const base: WeatherReading = {
  place: 'Sysmä',
  time: '2026-01-15T12:00:00Z',
  temperature: 10,
  windSpeed: 5,
  precipitation1h: 0,
}

test('seasonalAdvice warns about freezing temperatures', () => {
  const advice = seasonalAdvice({ ...base, temperature: -5 })
  assert.ok(advice.some((a) => a.includes('Pakkasta')))
})

test('seasonalAdvice warns about icy rain near freezing', () => {
  const advice = seasonalAdvice({
    ...base,
    temperature: 1,
    precipitation1h: 2,
  })
  assert.ok(advice.some((a) => a.includes('Loskaa')))
})

test('seasonalAdvice warns about strong wind and heavy rain', () => {
  const windy = seasonalAdvice({ ...base, windSpeed: 20 })
  assert.ok(windy.some((a) => a.includes('Kova tuuli')))

  const rainy = seasonalAdvice({ ...base, precipitation1h: 10 })
  assert.ok(rainy.some((a) => a.includes('Voimakasta sadetta')))
})

test('seasonalAdvice returns no warnings for calm mild weather', () => {
  assert.deepEqual(seasonalAdvice(base), [])
})

test('seasonalAdvice handles missing (null) readings without throwing', () => {
  const empty = seasonalAdvice({
    place: 'X',
    time: '',
    temperature: null,
    windSpeed: null,
    precipitation1h: null,
  })
  assert.deepEqual(empty, [])
})

test('formatWeather reports "ei saatavilla" for missing values', () => {
  const text = formatWeather({
    place: 'Sysmä',
    time: '',
    temperature: null,
    windSpeed: null,
    precipitation1h: null,
  })
  assert.ok(text.includes('ei saatavilla'))
  assert.ok(text.includes('Ilmatieteen laitos'))
})

test('formatWeather includes place, values and advice', () => {
  const text = formatWeather({ ...base, temperature: -2 })
  assert.ok(text.includes('Sysmä'))
  assert.ok(text.includes('-2 °C'))
  assert.ok(text.includes('Pakkasta'))
})

test('fetchWeather picks the last non-NaN reading per parameter', async () => {
  const xml = [
    '<wfs:FeatureCollection>',
    bsWfsElement('2026-09-04T10:00:00Z', 'temperature', '12.5'),
    bsWfsElement('2026-09-04T10:10:00Z', 'temperature', '12.8'),
    bsWfsElement('2026-09-04T10:20:00Z', 'temperature', 'NaN'), // ei vielä saapunut havainto
    bsWfsElement('2026-09-04T10:00:00Z', 'ws_10min', '3.1'),
    bsWfsElement('2026-09-04T10:10:00Z', 'ws_10min', '3.4'),
    bsWfsElement('2026-09-04T10:00:00Z', 'r_1h', 'NaN'),
    '</wfs:FeatureCollection>',
  ].join('\n')
  mockFetch(xml)

  const reading = await fetchWeather('Sysmä')
  assert.equal(reading.place, 'Sysmä')
  assert.equal(reading.temperature, 12.8)
  assert.equal(reading.time, '2026-09-04T10:10:00Z')
  assert.equal(reading.windSpeed, 3.4)
  assert.equal(reading.precipitation1h, null)
})

test('fetchWeather throws a clear error for an unknown place (ExceptionReport)', async () => {
  mockFetch(
    '<ExceptionReport><Exception><ExceptionText>No locations found for the place with the requested language!</ExceptionText></Exception></ExceptionReport>',
  )
  await assert.rejects(
    () => fetchWeather('Ei Ole Paikka'),
    /No locations found/,
  )
})

test('fetchWeather throws on a non-OK HTTP response', async () => {
  mockFetch('', false, 503)
  await assert.rejects(() => fetchWeather('Sysmä'), /HTTP 503/)
})
