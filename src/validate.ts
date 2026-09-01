// Syötteiden validointi — puhtaat funktiot, joita käytetään CLI-komennoissa ja testeissä.
// TUI validoi lomakkeet omassa tallennuslogiikassaan; nämä keskittävät säännöt yhteen paikkaan.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const ISO_MONTH = /^\d{4}-\d{2}$/

// Tarkistaa että merkkijono on kelvollinen kalenteripäivä muodossa YYYY-MM-DD.
// Hylkää mm. 2026-13-40, koska päivä ei säily edestakaisin muunnoksessa.
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function isIsoMonth(s: string): boolean {
  if (!ISO_MONTH.test(s)) return false
  const month = Number(s.slice(5, 7))
  return month >= 1 && month <= 12
}

// Suomalainen kiinteistötunnus: esim. 405-412-1-23 (kunta-sijainti-ryhmä-yksikkö).
export function isKiinteistotunnus(s: string): boolean {
  return /^\d{1,3}-\d{1,3}-\d{1,4}-\d{1,4}$/.test(s)
}

export function isNonNegativeNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

// Jäsentää käyttäjän antaman summan; palauttaa null jos ei kelvollinen (ei-negatiivinen) luku.
export function parseAmount(s: string): number | null {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export type Priority = 'low' | 'medium' | 'high'
export function isPriority(s: string): s is Priority {
  return s === 'low' || s === 'medium' || s === 'high'
}

export type TxType = 'income' | 'expense'
export function isTxType(s: string): s is TxType {
  return s === 'income' || s === 'expense'
}

// Kokoaa validointivirheet listaksi; tyhjä lista = kelvollinen.
export function validateTaskInput(input: {
  title: string
  priority: string
  cost: string
}): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('Otsikko ei voi olla tyhjä')
  if (!isPriority(input.priority))
    errors.push(
      `Kiireellisyys tulee olla low|medium|high (oli: ${input.priority})`,
    )
  if (parseAmount(input.cost) === null)
    errors.push(
      `Kustannuksen tulee olla ei-negatiivinen luku (oli: ${input.cost})`,
    )
  return errors
}

export function validateTransactionInput(input: {
  amount: string
  type: string
}): string[] {
  const errors: string[] = []
  if (parseAmount(input.amount) === null)
    errors.push(`Summan tulee olla ei-negatiivinen luku (oli: ${input.amount})`)
  if (!isTxType(input.type))
    errors.push(`Tyypin tulee olla income|expense (oli: ${input.type})`)
  return errors
}
