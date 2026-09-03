import { initDb } from '../schema.js'
import type { WastewaterAssessment, WastewaterSystem } from '../types.js'

export function getWastewaterSystems(propertyId?: number): WastewaterSystem[] {
  const db = initDb()
  const query = propertyId
    ? db.prepare(
        'SELECT * FROM wastewater_systems WHERE property_id = ? ORDER BY next_emptied ASC',
      )
    : db.prepare(
        'SELECT * FROM wastewater_systems ORDER BY property_id ASC, next_emptied ASC',
      )
  return (
    propertyId ? query.all(propertyId) : query.all()
  ) as WastewaterSystem[]
}

export function addWastewaterSystem(w: Omit<WastewaterSystem, 'id'>): void {
  const db = initDb()
  const stmt = db.prepare(`
    INSERT INTO wastewater_systems (property_id, type, permit_info, last_emptied, next_emptied, emptying_provider, build_year, shoreline, groundwater, has_wc, exemption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    w.property_id,
    w.type,
    w.permit_info,
    w.last_emptied ?? null,
    w.next_emptied ?? null,
    w.emptying_provider,
    w.build_year ?? 0,
    w.shoreline ?? 0,
    w.groundwater ?? 0,
    w.has_wc ?? 1,
    w.exemption ?? 0,
  )
}

export function updateWastewaterSystem(w: WastewaterSystem): void {
  const db = initDb()
  const stmt = db.prepare(`
    UPDATE wastewater_systems
    SET property_id = ?, type = ?, permit_info = ?, last_emptied = ?, next_emptied = ?, emptying_provider = ?, build_year = ?, shoreline = ?, groundwater = ?, has_wc = ?, exemption = ?
    WHERE id = ?
  `)
  stmt.run(
    w.property_id,
    w.type,
    w.permit_info,
    w.last_emptied ?? null,
    w.next_emptied ?? null,
    w.emptying_provider,
    w.build_year ?? 0,
    w.shoreline ?? 0,
    w.groundwater ?? 0,
    w.has_wc ?? 1,
    w.exemption ?? 0,
    w.id,
  )
}

// Arvioi jätevesijärjestelmän vaatimustenmukaisuuden (haja-asutuksen jätevesiasetus VNa 157/2017
// ja ympäristönsuojelulaki). HUOM: tämä on informatiivinen arvio, ei viranomaispäätös — kunnan
// ympäristönsuojeluviranomainen voi antaa tiukempia paikallisia määräyksiä.
export function assessWastewater(w: WastewaterSystem): WastewaterAssessment {
  const issues: string[] = []
  const actions: string[] = [
    'Pidä ajan tasalla selvitys jätevesijärjestelmästä sekä käyttö- ja huolto-ohje.',
  ]
  // Tyhjennysmuistutus koskee saostus- ja umpisäiliöitä.
  if (w.type === 'septic_tank' || w.type === 'soil_filter') {
    actions.push('Tyhjennä saostuskaivo lietteestä vähintään kerran vuodessa.')
  }
  if (w.type === 'sealed_tank') {
    actions.push(
      'Seuraa umpisäiliön täyttymistä ja tilaa tyhjennys ajoissa (täyttöhälytin suositeltava).',
    )
  }

  // Kunnan viemäri: ei kiinteistökohtaisia puhdistusvaatimuksia.
  if (w.type === 'mains_sewer') {
    return {
      level: 'ok',
      headline:
        'Liitetty kunnalliseen viemäriin — ei kiinteistökohtaisia puhdistusvaatimuksia.',
      issues: [],
      actions: [],
    }
  }

  // Onko käsittely riittävä nykyvaatimuksiin?
  let inadequate = false
  if (w.type === 'septic_tank') {
    inadequate = true
    issues.push(
      'Pelkkä saostuskaivo (esim. + kivipesäimeytys) on vain esikäsittely eikä täytä VNa 157/2017 puhdistusvaatimuksia (orgaaninen aine 80 % / fosfori 70 % / typpi 30 %).',
    )
  } else if (
    w.type === 'soil_filter' &&
    w.build_year > 0 &&
    w.build_year < 2004
  ) {
    inadequate = true
    issues.push(
      'Ennen nykyvaatimuksia rakennettu maasuodattamo ei välttämättä täytä puhdistusvaatimuksia — tarkistuta kunto ja puhdistusteho.',
    )
  }

  // Riittävä ratkaisu (umpisäiliö, pienpuhdistamo, uudehko maasuodattamo).
  if (!inadequate) {
    const hl =
      w.type === 'sealed_tank'
        ? 'Umpisäiliö on hyväksytty ratkaisu — huolehdi tyhjennyksestä.'
        : w.type === 'small_treatment'
          ? 'Pienpuhdistamo — huolehdi säännöllisestä huollosta ja seurannasta.'
          : 'Järjestelmä vaikuttaa täyttävän vaatimukset — huolehdi määräaikaishuollosta.'
    return { level: 'ok', headline: hl, issues, actions }
  }

  // Vähäiset jätevedet (ei vesikäymälää): kevyemmät vaatimukset.
  if (!w.has_wc) {
    issues.push(
      'Ei vesikäymälää → "vähäiset jätevedet": vaatimukset kevyemmät (harmaavesien käsittely riittää usein).',
    )
    return {
      level: 'warning',
      headline:
        'Vähäiset jätevedet — kevyemmät vaatimukset, mutta varmista riittävyys.',
      issues,
      actions,
    }
  }

  // Vapautus voimassa (ikä ≥ syntynyt ennen 9.3.1943 / vähäisyys).
  if (w.exemption) {
    issues.push(
      'Vapautus merkitty voimassa olevaksi (ikä-/vähäisyysperuste) — voimassaolo kannattaa varmistaa kunnalta.',
    )
    return {
      level: 'warning',
      headline:
        'Puute tunnistettu, mutta vapautus voi olla voimassa — varmista kunnalta.',
      issues,
      actions,
    }
  }

  // Herkkä alue (ranta ≤100 m tai pohjavesialue): lakisääteinen takaraja oli 31.10.2019.
  if (w.shoreline || w.groundwater) {
    const alue =
      w.shoreline && w.groundwater
        ? 'ranta- ja pohjavesialue'
        : w.shoreline
          ? 'ranta-alue (≤100 m vesistöstä)'
          : 'pohjavesialue'
    actions.unshift(
      `Herkkä alue (${alue}): saata järjestelmä vaatimusten mukaiseksi — lakisääteinen takaraja oli jo 31.10.2019.`,
    )
    return {
      level: 'action',
      headline: `Toimenpide tarpeen: herkän alueen takaraja (31.10.2019) on ohitettu.`,
      issues,
      actions,
    }
  }

  // Ei herkällä alueella: ei kiinteää takarajaa, korjaus kytkeytyy remonttiin.
  actions.unshift(
    'Ei kiinteää takarajaa (ei herkkä alue): korjausvelvoite laukeaa luvanvaraisen remontin tai vesi-/viemäri-/wc-korjauksen yhteydessä. Suositus: suunnittele päivitys.',
  )
  return {
    level: 'warning',
    headline:
      'Puute tunnistettu — ei kiinteää takarajaa, mutta korjaus tulee tehdä remontin yhteydessä.',
    issues,
    actions,
  }
}
