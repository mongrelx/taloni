// Sää- ja vuodenkiertointegraatio (issue #27): hakee ajantasaisen säähavainnon Ilmatieteen
// laitoksen (FMI) avoimesta datasta. Ei vaadi API-avainta. Tämä on ainoa ulkoinen verkkokutsu
// koko sovelluksessa — muu toiminta on täysin paikallinen (SQLite). Data: Ilmatieteen laitos,
// CC BY 4.0 (https://en.ilmatieteenlaitos.fi/open-data-licence).

const FMI_URL = 'https://opendata.fmi.fi/wfs'

export interface WeatherReading {
  place: string
  time: string // Viimeisimmän kelvollisen havainnon ajanhetki (ISO, UTC)
  temperature: number | null // °C
  windSpeed: number | null // m/s, 10 min keskiarvo
  precipitation1h: number | null // mm, viimeisin tunti
}

// Poimii paikkakunnan nimen kiinteistön location-kentästä (esim. "Sysmä, Finland" -> "Sysmä").
export function placeFromLocation(location: string): string {
  return (location.split(',')[0] ?? location).trim()
}

// Hakee ja jäsentää FMI:n "simple"-tallennetun kyselyn havaintodatan. XML jäsennetään
// säännöllisillä lausekkeilla (ei XML-jäsenninkirjastoa) — muoto on vakaa ja dokumentoitu:
// jokainen <BsWfs:BsWfsElement> sisältää Time/ParameterName/ParameterValue-kolmikon.
export async function fetchWeather(place: string): Promise<WeatherReading> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'getFeature',
    storedquery_id: 'fmi::observations::weather::simple',
    place,
    parameters: 'temperature,ws_10min,r_1h',
  })

  let res: Response
  try {
    res = await fetch(`${FMI_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    throw new Error(
      `Säätiedon haku epäonnistui (verkkovirhe): ${(e as Error).message}`,
    )
  }
  if (!res.ok) {
    throw new Error(`Säätiedon haku epäonnistui: HTTP ${res.status}`)
  }
  const xml = await res.text()

  if (xml.includes('ExceptionReport')) {
    const msg = xml.match(/<ExceptionText>(.*?)<\/ExceptionText>/s)?.[1]
    throw new Error(
      `Säätiedon haku epäonnistui: ${msg?.trim() ?? 'tuntematon paikkakunta tai virhe FMI:n avoimessa datassa'}`,
    )
  }

  const latest: Record<string, { time: string; value: number }> = {}
  const re =
    /<BsWfs:Time>(.*?)<\/BsWfs:Time>\s*<BsWfs:ParameterName>(.*?)<\/BsWfs:ParameterName>\s*<BsWfs:ParameterValue>(.*?)<\/BsWfs:ParameterValue>/gs
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-loop idiom
  while ((m = re.exec(xml))) {
    const [, time, name, valueStr] = m as unknown as [
      string,
      string,
      string,
      string,
    ]
    const value = Number(valueStr)
    if (!Number.isFinite(value)) continue // "NaN" = puuttuva/ei vielä saapunut havainto
    latest[name] = { time, value } // myöhemmät (tuoreemmat) havainnot korvaavat aiemmat
  }

  const time =
    latest.temperature?.time ?? latest.ws_10min?.time ?? latest.r_1h?.time ?? ''

  return {
    place,
    time,
    temperature: latest.temperature?.value ?? null,
    windSpeed: latest.ws_10min?.value ?? null,
    precipitation1h: latest.r_1h?.value ?? null,
  }
}

// Kevyitä, informatiivisia vuodenkiertohuomioita hirsitalolle/mökille nykysään perusteella.
// Ei ennustemalli — pelkkä sääntöpohjainen muistilista havaitun säätilan mukaan.
export function seasonalAdvice(r: WeatherReading): string[] {
  const advice: string[] = []
  if (r.temperature !== null && r.temperature <= 0) {
    advice.push(
      'Pakkasta — varmista ettei vesijohdot, kaivopumppu tai jätevesijärjestelmä pääse jäätymään.',
    )
  }
  if (
    r.temperature !== null &&
    r.temperature > 0 &&
    r.temperature <= 3 &&
    r.precipitation1h !== null &&
    r.precipitation1h > 0
  ) {
    advice.push(
      'Loskaa/jäätävää sadetta — liukkautta pihalla ja kulkuväylillä.',
    )
  }
  if (r.windSpeed !== null && r.windSpeed >= 15) {
    advice.push(
      'Kova tuuli — tarkista irtoesineet pihalta ja katon/piipun kunto myöhemmin.',
    )
  }
  if (r.precipitation1h !== null && r.precipitation1h >= 5) {
    advice.push(
      'Voimakasta sadetta — tarkkaile sadevesien poisjohtamista ja jätevesijärjestelmän kuormitusta.',
    )
  }
  return advice
}

export function formatWeather(r: WeatherReading): string {
  const lines: string[] = []
  lines.push(`=== SÄÄ — ${r.place} ===`)
  if (r.time) lines.push(`Havainto: ${r.time}`)
  lines.push('')
  lines.push(
    `Lämpötila: ${r.temperature === null ? 'ei saatavilla' : `${r.temperature} °C`}`,
  )
  lines.push(
    `Tuuli (10 min ka.): ${r.windSpeed === null ? 'ei saatavilla' : `${r.windSpeed} m/s`}`,
  )
  lines.push(
    `Sade (1 h): ${r.precipitation1h === null ? 'ei saatavilla' : `${r.precipitation1h} mm`}`,
  )
  const advice = seasonalAdvice(r)
  if (advice.length > 0) {
    lines.push('')
    for (const a of advice) lines.push(`⚠ ${a}`)
  }
  lines.push('')
  lines.push('Lähde: Ilmatieteen laitos, avoin data (CC BY 4.0)')
  return lines.join('\n')
}
