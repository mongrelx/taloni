// API-avainautentikointi REST-rajapinnalle (issue #32). Ei käyttäjätilejä/OAuthia — yksi tai
// useampi jaettu avain, joka tarkistetaan Authorization: Bearer <avain> -otsikosta jokaisella
// pyynnöllä (paitsi /health). Sopii yhden omistajan työkaluun; ei sovi monen käyttäjän palveluun.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function keyFilePath(): string {
  return join(homedir(), '.taloni', 'api_key')
}

// Palauttaa käytössä olevat avaimet: TALONI_API_KEY-ympäristömuuttuja (pilkulla eroteltuna,
// esim. Docker/OCI-käyttöönotossa) tai muuten levylle pysyvästi tallennettu, kertaalleen
// generoitu avain (~/.taloni/api_key) — säilyy uudelleenkäynnistysten yli.
export function loadOrCreateApiKeys(): string[] {
  const fromEnv = process.env.TALONI_API_KEY
  if (fromEnv?.trim()) {
    return fromEnv
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  }

  const path = keyFilePath()
  if (existsSync(path)) {
    const key = readFileSync(path, 'utf8').trim()
    if (key) return [key]
  }

  const key = randomBytes(24).toString('base64url')
  const dir = join(homedir(), '.taloni')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, key, { mode: 0o600 })
  console.log(`Uusi API-avain luotu ja tallennettu: ${path}`)
  console.log(`API-avain: ${key}`)
  return [key]
}

// Vakioaikainen (timing-safe) vertailu välittämän Bearer-tokenin ja tunnettujen avainten välillä,
// jotta vertailun kesto ei paljasta kuinka moni merkki täsmää.
export function isValidApiKey(token: string, validKeys: string[]): boolean {
  const tokenBuf = Buffer.from(token)
  return validKeys.some((k) => {
    const keyBuf = Buffer.from(k)
    if (keyBuf.length !== tokenBuf.length) return false
    return timingSafeEqual(tokenBuf, keyBuf)
  })
}

export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/)
  return match ? match[1]!.trim() : null
}
